# Snapshot Pi QQ Bot & NapCat 接入与部署手册

本手册基于 `Snapshot Pi` 与 `NapCat OneBot v11` 的集成实践，详细介绍 QQ 机器人系统的整体架构、文件清单、部署说明、数据时序及常见故障排除。

---

## 1. 整体架构分层

系统利用反向 WebSocket 客户端 (Reverse WebSocket Client) 模式对接，由后端 Express 服务拉起并监听 OneBot WebSocket 通道，实现无公网端口暴露的安全接入。

```text
┌──────────────────────────────────────────────────┐
│                   Frontend                       │
│           QQBotCard.tsx (React)                  │
│     启停控制 · 连接状态 · 答题统计 · 周报        │
└──────────────────────┬───────────────────────────┘
                       │ HTTP /api/qq/*
                       │ Socket.io pi-event
┌──────────────────────▼───────────────────────────┐
│               Backend (Express)                   │
│                   server.ts                       │
│     /api/qq/start · /stop · /status · /health     │
└──────────────────────┬───────────────────────────┘
                       │
┌──────────────────────▼───────────────────────────┐
│            QQ Adapter (qq-adapter.ts)             │
│                                                   │
│  ┌─────────────────┐  ┌──────────────────────┐   │
│  │ QQWebSocketServer│  │   QQAIService        │   │
│  │ (WS :3001)       │  │   Pi Agent 桥接      │   │
│  │  NapCat 连接     │  │   消息队列 · 限流    │   │
│  └────────┬────────┘  │   群上下文管理        │   │
│           │           └──────────┬───────────┘   │
│  ┌────────▼────────┐   ┌─────────▼──────────┐   │
│  │ OneBotMessage   │   │  collectResponse()  │   │
│  │ Handler         │   │  流式收集 AI 响应   │   │
│  │ 命令路由 · 触发 │   └────────────────────┘   │
│  │ 词检测 · 限流   │                             │
│  └─────────────────┘                             │
└──────────────────────┬───────────────────────────┘
                       │
          ┌────────────┼────────────┬──────────────┐
          ▼            ▼            ▼              ▼
   ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌────────────┐
   │qq-render │ │qq-quiz-  │ │qq-chat-  │ │qq-report-  │
   │-er.ts    │ │service.ts│ │refiner.ts│ │generator.ts│
   │KaTeX →   │ │SM-2 自测 │ │对话→知识 │ │学习分析周报│
   │PNG 渲染  │ │XP 积分   │ │卡片提取  │ │            │
   └──────────┘ └──────────┘ └──────────┘ └────────────┘
                       │
┌─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ┐
│            NapCatQQ 层（自动部署 · git ignore）  │
│                                                   │
│  napcat.bat → node.exe → index.js → napcat.mjs   │
│                      ↓                            │
│         OneBot v11 WebSocket Client               │
│      ws://127.0.0.1:3001/qq/ws                    │
└─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ┘
```

---

## 2. 文件清单与配置说明

### 2.1 后端业务模块
*   `backend/src/qq-adapter.ts`：消息网关中枢。实现 OneBot 协议处理、消息分发、队列限流和 Pi Agent 的绑定桥接。
*   `backend/src/qq-renderer.ts`：内容渲染引擎。检测 LaTeX 公式并借助无头浏览器（Puppeteer）动态渲染为 KaTeX PNG 卡片；对普通 Markdown 排版执行文本转码滤除。
*   `backend/src/qq-quiz-service.ts`：移动端自测服务。根据知识库置信度薄弱点推送考题，并统计经验值 (XP) 和答题表现。
*   `backend/src/qq-chat-refiner.ts`：群聊知识提取器。自动分析沉淀的群聊记录片段，由 LLM 提炼并自动创建 Wiki 卡片。
*   `backend/src/qq-report-generator.ts`：学习周报分析器。汇总近 7 天答题排行、打卡趋势，生成 Markdown 周报。
*   `backend/src/qq-logger.ts`：JSONL 格式的结构化日志组件，支持日志按日轮转与缓冲刷新。

### 2.2 物理目录角色
| 路径 | 是否提交 Git | 说明 |
| :--- | :---: | :--- |
| `config/qq-bot-config.json` | ✅ 是 | 统一的机器人参数控制（触发词、Quiz参数、限流设定、渲染引擎控制） |
| `config/napcat-templates/` | ✅ 是 | NapCat 连接与配置模板（onebot11.json, napcat.json, webui.json） |
| `napcat/` | ❌ 否 | 运行时程序目录。由 `setup-napcat.ps1` 从官方压缩包自动下载解压创建 |
| `napcat/napcat/config/` | ❌ 否 | 实际运行配置文件，首次运行或 Setup 时从 `napcat-templates` 复制而来 |
| `scripts/setup-napcat.ps1` | ✅ 是 | 负责下载、解压 NapCat Node.js 免打包自包含版并初始化配置 |
| `scripts/sync-qq-shell.ps1` | ✅ 是 | 自动读取注册表，同步本地最新 QQNT 二进制模块到 `napcat/` 目录下 |

---

## 3. NapCat 部署快速开始

### 3.1 首次部署
1. 安装项目主依赖：
   ```bash
   npm install
   ```
2. 运行一键配置部署脚本：
   ```batch
   powershell -NoProfile -ExecutionPolicy Bypass -File "scripts\setup-napcat.ps1"
   ```
   *该命令将自动从 Gitee/Github 获取 NapCat 自包含免安装包（内嵌 Node.js 与 QQNT 基础 DLL），解压至 `napcat/` 并注入模板配置。*

3. 双击 `start.bat` 运行系统，在浏览器打开系统面板，进入 **QQ Bot 选项卡** 点击 **启动**，或使用手机 QQ 扫描控制台弹出的二维码登录。

### 3.2 配置文件修改
*   **方式一（推荐，全局保存）**：直接修改 `config/napcat-templates/` 下的模板文件，修改后提交 Git，团队其他成员在运行 `setup.bat` 时将自动同步。
*   **方式二（本地定制）**：启动 QQ 机器人后，直接访问 `http://127.0.0.1:6099/webui`（端口及 token 来自本地配置），使用 NapCat 官方 Web 控制面板修改。修改内容将实时保存在 `napcat/napcat/config/onebot11.json` 内（不加入版本控制）。

### 3.3 重新完整安装
若遇到 NapCat 程序损坏或需要覆盖式更新：
```batch
powershell -NoProfile -ExecutionPolicy Bypass -File "scripts\setup-napcat.ps1" -Force
```
> [!WARNING]
> `-Force` 参数会清空整个 `napcat/` 目录并从头重新解压下载。在此期间，脚本会对 `onebot11.json` 中配置的 WebSocket 账户连接信息进行自动备份和安全恢复，以防止覆盖本地连接配置。

---

## 4. 数据流与业务时序

### 4.1 消息接收 → AI 回复（群聊触发）
```text
QQ 群消息 (触发词匹配)
    │
    ▼
NapCat (OneBot v11 客户端) ──── ws://127.0.0.1:3001/qq/ws ────► QQWebSocketServer
                                                                     │
                                                               路由分发触发
                                                                     │
                                                                     ▼
                                                                QQAIService
                                                                     │
                                                             建立 Pi 会话并 Prompt
                                                                     │
                                                                     ▼
                                                             流式收集 AI 回答
                                                                     │
                                                           调用 qq-renderer PNG 渲染
                                                                     │
                                                                     ▼
                                                         CQ 码 [CQ:image...] 发送回复
```

### 4.2 自测系统 (Quiz) 运行逻辑
1. 用户在群里发送 `/quiz start` 命令。
2. `qq-quiz-service.ts` 收到指令，通过 `GET /api/knowledge/cards` 请求获取用户知识库中有效置信度最弱的技术概念。
3. 调用 LLM 构思题库并生成选择题（单次拉取 3 道题目）。
4. 机器人将题目和选项发进群组。通过缓存的答题状态 Map 对特定 QQ 用户的输入进行匹配与超时判断。
5. 答题对错直接作为复习历史计入 `SM-2` 评分，重置或提升对应知识卡片的置信度，并发放或扣除打卡 XP。

---

## 5. QQ 终端多模态内容渲染引擎

为了在官方 QQ 气泡内完美呈现高质量排版，系统会对 AI 输出进行并行处理：

### 5.1 严密数学公式卡片渲染 (Puppeteer)
当 AI 的文本流中检测到有 Markdown 数学块（如 `$$...$$` 或 `$...$`）时，内容将被导入至预装了 KaTeX 的本地无头浏览器（Puppeteer 实例）中渲染：
1. 自动生成包含 KaTeX CSS 的单页 HTML。
2. 驱动 Puppeteer 截图并裁剪为 PNG。
3. 利用 CQ 码 `[CQ:image,file=...]` 进行图像发送。

### 5.2 文本讲解转换器 (Markdown-to-PlainText)
普通文本讲解进行防错与美化滤除：
*   标题 `#` 重写为 `📌 标题` 等引导符。
*   列表 `-` 转换为数字 Emoji 如 1️⃣ / 2️⃣。
*   加粗 `**` 转换为带有中括号的特别标识 `【内容】`。
*   段落首行追加双空格缩进，保障在 QQ 消息框中的排版对齐。

---

## 6. 端口占用与常见故障

### 6.1 常用端口映射
| 服务 | 默认端口 | 作用说明 |
| :--- | :---: | :--- |
| **Express Backend** | 3000 | 项目后端网关 API 服务 |
| **QQ WebSocket** | 3001 | 后端搭建的反向 OneBot WS 监听端口 |
| **Vite Dev Server** | 5173 | 开发环境下的前端 React 视图服务 |
| **NapCat WebUI** | 6099 | NapCat 自带的配置后台面板 |

### 6.2 常见部署报错排查
*   **启动提示“NapCat 未安装”**：未成功运行 Setup 流程。请确保运行了 `scripts/setup-napcat.ps1`，且没有由于脚本运行权限（ExecutionPolicy）被拦截。
*   **启动后 NapCat 不断闪退重启**：
    1. 端口 `3001` 已被占用。可更换配置端口。
    2. 本地 QQ 升级后核心 DLL 冲突。请在根目录执行 `powershell -File scripts/sync-qq-shell.ps1` 进行自动对齐。
    3. `onebot11.json` 中配置的反向 WebSocket 格式错误。正确的地址为 `ws://127.0.0.1:3001/qq/ws`。
