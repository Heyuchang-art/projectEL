# QQ Bot 架构梳理

> 基于 Snapshot Pi × NapCat OneBot v11 的 QQ 机器人系统
>
> **部署方式**: NapCat 独立部署于 `napcat/`（git ignore），由 `scripts/setup-napcat.ps1` 自动下载安装，配置模板位于 `config/napcat-templates/`

---

## 一、整体架构分层

```
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

## 二、文件清单

### 2.1 后端核心

| 文件 | 行数 | 职责 |
|------|------|------|
| `backend/src/qq-adapter.ts` | 1214 | **神经中枢**——WebSocket 服务器、OneBot 协议处理、消息路由、AI 桥接 |
| `backend/src/qq-renderer.ts` | 345 | **内容渲染**——LaTeX 公式检测、KaTeX→PNG 截图、纯文本回退 |
| `backend/src/qq-quiz-service.ts` | 463 | **自测系统**——SM-2 置信度、XP 积分、多轮问答 |
| `backend/src/qq-chat-refiner.ts` | 267 | **知识提取**——群聊沉淀→LLM 提取→自动创建 wiki 卡片 |
| `backend/src/qq-report-generator.ts` | 237 | **学习报告**——薄弱知识分析、学习趋势 |
| `backend/src/qq-logger.ts` | 151 | **结构化日志**——JSONL 日轮转 + 缓冲区刷新 |

### 2.2 前端

| 文件 | 职责 |
|------|------|
| `frontend/src/components/QQBotCard.tsx` | QQ Bot 监控面板（启停、状态、统计、周报） |

### 2.3 NapCat 层（自动部署 · git ignore）

> ⚠️ `napcat/` 整个目录由 `scripts/setup-napcat.ps1` 从 `NapCat.Shell.Windows.Node.zip` 自动部署，**不在 git 版本控制中**。
> 首次使用需运行 `powershell -File scripts\setup-napcat.ps1` 完成部署。详见 [NapCat 部署指南](napcat-deployment.md)。

| 文件 | 职责 | 来源 |
|------|------|------|
| `napcat/napcat.bat` | 启动入口 → 调用 `node\node.exe` | Node.zip 内置 |
| `napcat/node/node.exe` | 嵌入式 Node.js 运行时 | Node.zip 内置 |
| `napcat/napcat/napcat.mjs` | NapCat 核心（OneBot v11 实现） | Node.zip 内置 |
| `napcat/napcat/config/onebot11.json` | OneBot 网络连接配置 | 从模板复制 |
| `napcat/napcat/config/napcat.json` | NapCat 运行时配置 | 从模板复制 |
| `napcat/napcat/config/webui.json` | WebUI 端口/token 配置 | 从模板复制 |
| `napcat/QQNT.dll` | QQ NT 原生 DLL | Node.zip 内置 |
| `napcat/index.js` | NapCat 入口（由 napcat.bat 加载） | Node.zip 内置 |

### 2.4 配置（git 追踪）

| 文件 | 职责 |
|------|------|
| `config/qq-bot-config.json` | **统一配置入口**——启停、触发词、限流、渲染、测验参数、NapCat 路径 |
| `config/napcat-templates/onebot11.json` | OneBot WS 连接配置模板（部署时复制到 napcat） |
| `config/napcat-templates/napcat.json` | NapCat 运行时配置模板 |
| `config/napcat-templates/webui.json` | WebUI 端口/token 模板 |

---

## 三、数据流

### 3.1 消息接收 → AI 回答（群聊）

```
QQ 群消息
    │
    ▼
NapCat (napcat.mjs)
    │ OneBot v11 WS 协议包
    ▼
QQWebSocketServer (ws://0.0.0.0:3001/qq/ws)
    │
    ▼
OneBotMessageHandler.handleGroupMessage()
    │
    ├─ sanitizeInput()         ← 清洗控制字符
    ├─ checkRateLimit()        ← 限流检查（5次/10秒）
    ├─ isBotMentioned()        ← @bot / /ai / /ask
    ├─ isCmd?                 ← 以 / 开头？
    │   ├─ 是 → aiService.handleCommand()
    │   │    ├─ /quiz-start
    │   │    ├─ /quiz-stop
    │   │    ├─ /quiz-stats
    │   │    └─ /help
    │   └─ 否 → isQuizActive?
    │       ├─ 是 → submitQuizAnswer()
    │       └─ 否 → aiService.handleGroupMessage()
    │
    ▼
QQAIService.handleGroupMessage()
    │
    ├─ addMessageToContext()         ← 群上下文（最近 20 条）
    ├─ maybeRefineContext()          ← 异步触发知识提取
    ├─ getOrCreateSession()          ← Pi Agent 会话
    ├─ buildContextPrefix()          ← 构建历史上下文
    ├─ collectResponse()             ← 流式收集 AI 回答
    │
    ▼
ContentRouter.routeMessage()
    │
    ├─ Track A: 含 LaTeX 公式
    │   FormulaRenderer.renderFormulaToPNG() → [CQ:image]
    │
    └─ Track B: 纯文本
        markdownToPlainText() → chunkMessage() → 分段发送
```

### 3.2 启动流程

```
WebUI 点击"启动"
    │ POST /api/qq/start
    ▼
server.ts
    │
    ├─ 检查 napcat/napcat.bat 是否存在
    │   ├─ 否 → 返回错误 "NapCat 未安装，请运行 scripts\setup.bat"
    │   └─ 是 → 继续
    │
    ├─ initQQAdapter()               ← 创建 WS 服务器 :3001
    │   └─ QQWebSocketServer          ← NapCat 连接入口
    │
    └─ spawn('napcat.bat')           ← 启动 NapCat 进程
        │
        ▼
    napcat.bat
        │ node.exe ./index.js
        ▼
    index.js
        │ 设置环境变量:
        │ NAPCAT_WRAPPER_PATH = napcat/wrapper.node
        │ NAPCAT_QQ_PACKAGE_INFO_PATH = napcat/package.json
        │ NAPCAT_QQ_VERSION_CONFIG_PATH = napcat/config.json
        │
        ▼
    napcat.mjs
        │ 读取配置 → 连接 WS → 登录 QQ → 接收消息
        ▼
    ws://127.0.0.1:3001/qq/ws
        │ 建立 WebSocket 连接
        ▼
    QQWebSocketServer  ←→ 消息双向流转
```

### 3.3 停止流程

```
WebUI 点击"停止"
    │ POST /api/qq/stop
    ▼
server.ts
    │
    ├─ qqServiceActive = false        ← 阻止自动重启
    ├─ clearTimeout(restartTimer)     ← 取消待执行的重启
    ├─ stopQQAdapter()                ← 关闭 WS 服务器
    │   └─ QQWebSocketServer.close()
    ├─ taskkill /PID ...              ← 杀 NapCat 进程
    └─ qq-bot-config.json enabled: false
```

---

## 四、配置详解

> 📁 配置文件现在统一放在 `config/` 下。
> `config/napcat-templates/` 为模板（git 追踪），`napcat/napcat/config/` 为运行时副本（git ignore）。

### 4.1 `config/qq-bot-config.json`

```json
{
  "enabled": false,              // 是否在服务启动时自动初始化
  "napcat": {
    "path": "napcat/napcat.bat",  // NapCat 启动脚本路径
    "templateDir": "config/napcat-templates"
  },
  "wsPath": "/qq/ws",           // WebSocket 路径（NapCat 连接地址）
  "accessToken": "",             // WebSocket 鉴权 Token
  "dedicatedPresetId": "qq-tutor", // Pi Agent 预设 ID
  "maxGroupContextMessages": 20, // 群上下文保留消息数
  "rateLimit": {
    "maxMessages": 5,            // 窗口内最大消息数
    "windowSeconds": 10          // 限流窗口（秒）
  },
  "triggerKeywords": ["@bot", "/ai", "/ask"], // 触发词
  "quiz": {
    "enabled": true,
    "questionsPerRound": 3,
    "xpPerGrade": { "0": 0, "1": 1, "2": 3, "3": 5, "4": 10 }
  },
  "rendering": {
    "formulaImageWidth": 800,
    "maxMessageLength": 1500,
    "messageChunkOverlap": 100
  },
  "groupSync": {
    "enabled": true,
    "allowedGroupIds": []
  }
}
```

### 4.2 `config/napcat-templates/onebot11.json`

```json
{
  "network": {
    "websocketClients": [{
      "name": "Snapshot Pi",
      "enable": true,
      "url": "ws://127.0.0.1:3001/qq/ws",
      "token": "",
      "messagePostFormat": "array",
      "reportSelfMessage": false,
      "reconnectInterval": 5000,
      "heartInterval": 30000
    }]
  },
  "enableLocalFile2Url": true,
  "parseMultMsg": false
}
```

NapCat 启动后以 **WebSocket 客户端**身份连接后端的 WS 服务器。

---

## 五、当前已知问题

| # | 问题 | 状态 | 根因 |
|---|------|------|------|
| 1 | `wrapper.node` 版本不匹配 → "not a valid Win32 application" | ❌ 待修复 | `wrapper.node` 与 `napcat.mjs` 来自不同 NapCat 版本 |
| 2 | `napcat/config.json` 等 JSON 文件含 BOM → JSON.parse 崩溃 | ✅ 已修复 | 添加 `scripts/strip-bom.js` + 3 处调用点 |
| 3 | 端口 3001 被占用 → 后端崩溃 | ✅ 已修复 | `wss.on('error')` 处理器 |
| 4 | NapCat 崩溃后窗口闪退，看不到错 | ✅ 已修复 | `napcat.bat` 加 `pause` |
| 5 | 无自动重启 → NapCat 挂了没人拉 | ❌ 待修复 | spawn 无 exit 监听 |
| 6 | `qq-adapter.ts` 1214 行，职责混杂 | ❌ 待重构 | 一个文件塞了 WS 服务、消息路由、AI 桥接、命令系统、限流 |
| 7 | NapCat 部署与 git 仓库未隔离 → 834 个临时目录污染 | ✅ 已设计 | 见 [部署重设计 Spec](superpowers/specs/2026-06-11-napcat-deployment-redesign.md)，`napcat/` 整体 gitignore |
| 8 | Windows 独占 | ❌ 待决策 | NapCat Shell 是 Win32 原生二进制 |

---

## 六、核心类关系

```
QQWebSocketServer (单例)
  ├── owns → Map<selfId, QQConnection>
  │            └── WebSocket 连接封装
  │                 ├── sendApiCall()     ← OneBot API 调用
  │                 ├── 心跳检测（60s超时）
  │                 └── 自动重试（3次，指数退避）
  │
  ├── uses → OneBotMessageHandler
  │            ├── handleGroupMessage()   ← 群消息路由
  │            ├── handlePrivateMessage() ← 私聊路由
  │            └── checkRateLimit()       ← 限流器
  │
  └── bridge → QQAIService
                 ├── getOrCreateSession() ← Pi Agent 会话
                 ├── handleCommand()      ← /命令 路由
                 ├── handleGroupMessage() ← AI 群聊回答
                 ├── handlePrivateMessage()← AI 私聊回答
                 ├── collectResponse()    ← 流式读取 AI 输出
                 ├── submitQuizAnswer()   ← 答题提交
                 ├── sessionLocks         ← 会话队列（防止并发）
                 └── groupContexts        ← 群上下文缓存
```

---

## 七、关键配置关联

```
config/                      napcat/（运行时 · git ignore）
┌──────────────────────┐     ┌──────────────────────────┐
│ qq-bot-config.json   │     │ napcat/napcat/config/    │
│   wsPath: /qq/ws ────┼────→│   onebot11.json          │
│   accessToken ───────┼────→│     url + token          │
│   enabled ───────────┼──┐  │   napcat.json            │
│   dedicatedPreset ───┼─→│  │   webui.json             │
│   quiz.* ────────────┼─→│  └──────────────────────────┘
│   rendering.* ───────┼─→│            ↑
│   rateLimit.* ───────┼─→│            │ 复制自
│   napcat.path ───────┼─→│  ┌──────────────────────────┐
└──────────────────────┘  │  │ config/napcat-templates/  │
                           │  │   (git 追踪的模板)        │
                           │  └──────────────────────────┘
                           │
  ┌────────────────────────┼────────────────────────┐
  │ QQAIService            │                        │
  │   presetId ←───────────┘                        │
  │ QuizService ←───────────────────────────────────┤
  │ ContentRouter ←─────────────────────────────────┤
  │ OneBotMessageHandler ←──────────────────────────┤
  │ spawn ←─────────────────────────────────────────┤
  └─────────────────────────────────────────────────┘
```

---

*文档版本: 2026-06-11*
