# 🎨 Snapshot Pi WebUI & Desktop Client 统一设计规范白皮书

本白皮书作为项目前端与桌面端开发的核心指导性设计规范，旨在分析和指导 `Snapshot Pi` 桌面客户端（Electron）的整体视觉风格、布局架构、子进程管理以及各类交互卡片的设计与实现。

---

## 🗺️ 1. 核心视觉风格：苹果风玻璃悬浮 (Apple Fluent Glassmorphism)

根据最新架构设计决议，系统前端彻底摆脱 Neo-Brutalist 风格，升级为**轻量悬浮、毛玻璃磨砂（Glassmorphism）、大圆角、流光弥散背景的 Apple Fluent 体验**，且同时兼容 **深色玻璃模式** 与 **亮色玻璃模式**。

### 1.1 双主题玻璃参数规范
系统底层引入基于 CSS 变量的主题管理，通过在 HTML 根节点切换 `data-theme="dark"` 或 `data-theme="light"` 达成全局平滑切换：

| CSS 变量键名 | 🌑 深色玻璃模式 (Dark Glassmorphism) | ☀️ 亮色玻璃模式 (Light Glassmorphism) |
| :--- | :--- | :--- |
| `--bg-color` | 深空钛灰 (`#08080c`) | 冰川白雾 (`#f2f4f8`) |
| `--panel-bg` | 半透明炭黑 (`rgba(22, 22, 28, 0.5)`) | 半透明牛奶白 (`rgba(255, 255, 255, 0.45)`) |
| `--panel-border` | 极细透光白 (`1px solid rgba(255,255,255,0.08)`) | 极细透光灰 (`1px solid rgba(0,0,0,0.06)`) |
| `--panel-border-active`| 高亮白光边 (`1px solid rgba(255,255,255,0.22)`) | 灰黑压边 (`1px solid rgba(0,0,0,0.16)`) |
| `--text-main` | 极地白 (`#f8fafc`) | 曜石黑 (`#0f172a`) |
| `--text-muted` | 灰蓝 (`#94a3b8`) | 板岩灰 (`#475569`) |
| `--primary` | 极光紫 (`#6366f1`) | 皇家靛蓝 (`#4f46e5`) |
| `--secondary` | 冰晶蓝 (`#06b6d4`) | 苍穹蓝 (`#0284c7`) |
| `--accent` | 珊瑚粉 (`#ec4899`) | 蔓越莓红 (`#db2777`) |
| `--glass-blur` | `blur(20px) saturate(190%)` | `blur(20px) saturate(190%)` |
| `--glass-shadow` | 漫反射深邃投影 `0 12px 40px rgba(0,0,0,0.4)` | 优雅微投影 `0 12px 40px rgba(31,38,135,0.06)` |

### 1.2 背景弥散流光 (Mesh Gradients)
为了提供 Apple 般自然灵动的生命力，背景层不再采用普通的纯色或格线，而是引入了**后台流动的弥散渐变球（Mesh Gradients）**：
*   在 Body 中使用两个/三个高斯模糊（`filter: blur(80px)`）的彩色半透明圆形 DIV，映射底层的主题基色。
*   配以温和的慢速帧动画（`animation: floatCircle 20s infinite alternate`），使背景呈现呼吸般的彩色流光溢彩，折射在毛玻璃卡片上极具品质感。
*   **渐变主题预设包**：
    *   *静谧极光* (Default): 青绿 (`#00f2fe`) 与 深靛紫 (`#6366f1`) 混合流动。
    *   *日落余晖*: 珊瑚橙 (`#f97316`) 与 蔓越莓红 (`#db2777`) 混合流动。
    *   *冰川深海*: 冰晶蓝 (`#06b6d4`) 与 深海蓝 (`#1d4ed8`) 混合流动。

### 1.3 几何与阻尼弹簧动效
*   **圆润几何 (Soft Contours)**: 窗口/卡片容器统一使用大圆角 `rounded-[20px]`，输入框与按钮统一使用中圆角 `rounded-[12px]`。
*   **弹簧过渡 (Spring Transitions)**: 所有的 Hover、Active 和 Panel 弹出事件，均采用阻尼弹簧过渡曲线：`transition: all 0.4s cubic-bezier(0.25, 0.8, 0.25, 1)`，Hover 时卡片上移 `translateY(-2px)`，伴随轻微发色和投影软化。

---

## 🎯 2. UI 布局系统：Google AI Studio 风格分栏

系统主界面摒弃原有的多卡片零散排列，采用 **Google AI Studio** 风格的高效分栏协同布局：

```text
+-----------------+----------------------------------------+-------------------+
|  L              |                 Center                 |         R         |
|  E              |               Workspace                |         I         |
|  F              |              (60% Width)               |         G         |
|  T              |                                        |         H         |
|                 | +------------------------------------+ |         T         |
|  S              | |                                    | |  Parameter Panel  |
|  I              | |        Chat Message Stream         | |    (30% Width)    |
|  D              | |                                    | |                   |
|  E              | |                                    | | [System Prompts]  |
|  B              | +------------------------------------+ |  Write core instructions|
|  A              |                                        |  here in real-time  |
|  R              | +------------------------------------+ |                   |
|                 | | [ / Suggestion Popover ]           | | [Model Settings]  |
|  (10% Width)    | | [Input Capsule             Token#] | |  - Temp Sliders   |
|                 | +------------------------------------+ |  - Max Tokens     |
+-----------------+----------------------------------------+-------------------+
```

### 2.1 左侧全局导航栏 (Sidebar - 10% 宽度)
*   **功能映射**：提供五大核心视图的开关切换项（💬 聊天、⚙️ 技能编排、📚 知识图谱、🤖 QQ 监控、⚙️ 设置）。
*   **样式表现**：超窄悬浮磨砂玻璃条，选中状态图标产生发光渐变，并在边缘带有微细指示点。

### 2.2 中部主工作区 (Chat Workspace - 60% 宽度)
*   **聊天卡片 (ChatCard)**：位于工作区中心，左侧自带可收缩的会话历史侧栏，中间为聊天流与底部输入区。
*   **输入胶囊 (Input Capsule)**：
    *   多行文本框高度随字数自适应增长。
    *   **Token 实时统计条**：实时渲染当前输入文本的 Token 消耗，帮助优化 API 成本感知。
    *   **多模态图片处理**：支持拖拽或 `Ctrl+V` 上传图片。上传后，上层覆盖半透明毛玻璃蒙版并播放脉冲呼吸加载动画，后台识图子智能体提取图像细节文字后静默拼接在 Prompt 顶部，提供无感的多模态体验。

### 2.3 右侧常驻参数面板 (AgentSettingsCard - 30% 宽度)
*   **系统指令区 (System Instructions)**：顶部显要位置为多行文本域，支持用户直接修改/编写当前 AI 会话的 System Prompt，修改后即时生效。
*   **微调与模型选择 (Session Tuning)**：
    *   下拉菜单快速选择绑定智能体预设或切换 `deepseek-v4-pro`。
    *   提供滑块调节 `Temperature`（0.0 至 2.0）、`Max Output Tokens`、以及针对不良内容的 `Safety Settings` 安全级别滑块。
*   **挂载绑定器 (Binder)**：提供复选框，一键将当前 `skills/` 下的低代码画板技能或参考文档挂载给该智能体。

---

## 🛠️ 3. CSS 与 TailwindCSS / Shadcn UI 规范

为了实现优美的界面，前端使用 TailwindCSS v3 作为主要样式框架，并引入 Shadcn UI 组件：

### 3.1 变量映射与 Tailwind 主题配置
在 `tailwind.config.js` 中将 CSS 主题变量映射为 Tailwind 实用类名：
```javascript
module.exports = {
  theme: {
    extend: {
      colors: {
        background: 'var(--bg-color)',
        panel: 'var(--panel-bg)',
        primary: 'var(--primary)',
        secondary: 'var(--secondary)',
        accent: 'var(--accent)',
      },
      boxShadow: {
        glass: '0 12px 40px rgba(0,0,0,0.12)',
        neo: '5px 5px 0px #000000',
      }
    }
  }
}
```

### 3.2 Shadcn 组件的新野兽主义/毛玻璃微改造
由于原生的 Shadcn UI 组件相对常规扁平，我们在将组件（如 `Button`, `Dialog`, `Tabs`）导入至 `components/ui/` 后，需进行特定的定制：
*   **圆角与边框**：将圆角属性统一控制在 `rounded-[12px]` 或圆润形态，移出默认的柔和灰色边框，替换为发光半透明透光边框 `border-white/8`。
*   **材质层**：给 `DialogContent`, `PopoverContent` 以及 `TabsList` 组件添加 `bg-panel backdrop-blur-md` 类，维持全局苹果风玻璃的透光磨砂质感。

---

## 💻 4. 桌面客户端架构 (Electron Sidecar Process)

桌面端应用由 Electron 主导，采用“主窗口 + 后端子进程（Sidecar）”的混合启动模式。

```text
+-------------------------------------------------------------+
|                     Electron 主进程                         |
|   1. 检查端口 3000/3001 占用                                |
|   2. spawn/fork 后端子进程 -> backend/dist/server.js         |
|   3. 启动 GUI 主窗口 (加载开发 URL 或静态 html)             |
+----------------------+--------------------------------------+
                       | IPC (preload.ts)
                       v
+-------------------------------------------------------------+
|                    Electron 渲染进程                        |
|   1. 渲染 React / TailwindCSS 界面                          |
|   2. 通过 Socket.io/HTTP 请求与后端 server 通信            |
+-------------------------------------------------------------+
```

### 4.1 进程拉起与容错
*   在开发阶段，主进程自动探测 `VITE_DEV_SERVER_URL`，加载 Vite 热更新页面；在生产阶段，加载 `dist/index.html`。
*   启动时执行端口验证，若端口已被占用，弹出 Electron 提示框并友好退出。

### 4.2 退出捕获与僵尸进程处理
*   主进程监听 `will-quit` 和 `before-quit` 事件，在退出前主动触发 `backendProcess.kill('SIGINT')`。
*   后端服务 `server.ts` 会轮询检测父进程连接状态。如果 Electron 主进程意外退出，后端子进程会自动检测并调用 `process.exit(0)` 主动释放资源。

---

## 🔄 5. 后端 API 支撑规范

后端需要提供以下路由端点，支持前端的 Google AI Studio 布局与系统监控：

1.  **多会话控制 (Sessions API)**：
    *   `GET /api/sessions`：列出所有用户和机器人的会话。
    *   `POST /api/sessions/create`：创建新会话并指定智能体。
    *   `POST /api/sessions/switch`：切换当前的活跃会话。
2.  **智能体工厂 (Agents API)**：
    *   `GET /api/agents`：获取所有的预设智能体列表。
    *   `POST /api/agents`：新建一个智能体（包括 System Prompt, 模型, 绑定的 Skills 列表等）。
    *   `PUT /api/agents/:id`：修改智能体预设属性。
3.  **系统与 QQ 状态监控**：
    *   `POST /api/qq/start` 与 `POST /api/qq/stop`：通过子进程一键控制 OneBot 适配器的开启与关闭，并将进程运行日志流式写入前端控制台面板。
