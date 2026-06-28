# Snapshot Pi UI 设计与桌面客户端封装手册

本手册详述了 `Snapshot Pi` 系统的 Web 界面设计规范、Tailwind/Shadcn 的整合准则、Electron 桌面端容器封装架构（双进程 Sidecar 模式），以及 Windows 平台下的安装包与绿色版打包指南。

---

## 1. 核心视觉风格：苹果风玻璃悬浮 (Apple Fluent Glassmorphism)

系统采用轻量悬浮、毛玻璃磨砂（Glassmorphism）、大圆角、流光弥散背景的 Apple Fluent 体验，支持深色与亮色双主题的平滑切换。

### 1.1 双主题玻璃参数规范
系统通过在 HTML 根节点切换 `data-theme="dark"` 或 `data-theme="light"` 进行全局主题管理：

| CSS 变量键名 | 🌑 深色玻璃模式 (Dark Glassmorphism) | ☀️ 亮色玻璃模式 (Light Glassmorphism) |
| :--- | :--- | :--- |
| `--bg-color` | 深空钛灰 (`#08080c`) | 冰川白雾 (`#f2f4f8`) |
| `--panel-bg` | 半透明炭黑 (`rgba(22, 22, 28, 0.5)`) | 半透明牛奶白 (`rgba(255, 255, 255, 0.45)`) |
| `--panel-border` | 极细透光白 (`1px solid rgba(255,255,255,0.08)`) | 极细透光灰 (`1px solid rgba(0,0,0,0.06)`) |
| `--panel-border-active`| 高亮白光边 (`1px solid rgba(255,255,255,0.22)`) | 灰黑压边 (`1px solid rgba(0,0,0,0.16)`) |
| `--text-main` | 极地白 (`#f8fafc`) | 曜石黑 (`#0f172a`) |
| `--text-muted` | 灰蓝 (`#94a3b8`) | 板岩灰 (`#475569`) |
| `--primary` | 极光紫 (`#6366f1`) | 皇家靛蓝 (`#4f46e5`) |
| `--glass-blur` | `blur(20px) saturate(190%)` | `blur(20px) saturate(190%)` |
| `--glass-shadow` | 漫反射深邃投影 `0 12px 40px rgba(0,0,0,0.4)` | 优雅微投影 `0 12px 40px rgba(31,38,135,0.06)` |

### 1.2 背景弥散流光 (Mesh Gradients)
背景层引入后台缓慢流动的弥散渐变球（Mesh Gradients）：
*   使用两到三个带高斯模糊（`filter: blur(80px)`）的彩色半透明圆形 DIV，映射底层的主题基色。
*   配以慢速呼吸帧动画（`animation: floatCircle 20s infinite alternate`），使背景呈现呼吸般的彩色流动，折射在毛玻璃卡片上。
*   **渐变球基色预设**：
    *   *静谧极光* (Default): 青绿 (`#00f2fe`) 与 深靛紫 (`#6366f1`)。
    *   *日落余晖*: 珊瑚橙 (`#f97316`) 与 蔓越莓红 (`#db2777`)。

### 1.3 动效与几何
*   **阻尼弹簧过渡**：Hover、Active 等事件统一采用弹簧过渡曲线：`transition: all 0.4s cubic-bezier(0.25, 0.8, 0.25, 1)`。Hover 时卡片轻微上移并软化投影。
*   **圆润轮廓**：外层容器统一使用大圆角 `rounded-[20px]`，内层输入框与按钮统一使用中圆角 `rounded-[12px]`。

---

## 2. UI 布局系统：专注模式与多栏工作区自适应

为了兼顾“Google AI Studio 风格的单会话深度调整”与“并排编辑画布/查阅知识库的多窗协同”，系统采用**自适应联动布局系统**，通过左侧边栏的活动卡片状态（`activeCards`）进行智能切换。

### 2.1 专注模式 (Focus Mode)
当左侧边栏仅启用了 `chat` 卡片时（`activeCards` 长度为 1 且仅含 `chat`），系统自动进入专注模式。布局锁定为标准的 **Google AI Studio 三栏布局**，此时屏蔽多窗拖拽的拖拽条：
*   **左栏 (Sidebar - 10% 宽度)**：超窄悬浮磨砂玻璃条，提供核心功能的开关切换。
*   **中栏 (Chat Workspace - 60% 宽度)**：包括会话列表与对话流主视窗。底部采用高度自适应的 **输入胶囊 (Input Capsule)**，集成 Token 统计及多模态图片上传。
*   **右栏 (Parameter Panel - 30% 宽度)**：常驻显示 **Session 参数调节面板**（AgentSettingsCard），提供 System Instructions、模型切换以及 Temperature 等滑块。

### 2.2 工作区模式 (Workspace Mode)
当启用了 `chat` 以外的任何卡片时（例如并排开启 `chat` 与 `canvas` 画布），系统无缝切换到 **Workspace 多列拖拽分栏布局**：
*   **主工作区**：[Workspace.tsx](file:///c:/Users/lisky/Desktop/projectEL/frontend/src/components/Workspace.tsx) 占据剩余全部宽度，各卡片以列为单位排列，允许用户自由拖拽、关闭及调整列宽。
*   **卡片内参数抽屉**：为了避免挤占多栏分栏的宝贵宽度，原本常驻在右侧的 30% 参数面板会在屏幕主页面上隐藏。相反，在 [ChatCard.tsx](file:///c:/Users/lisky/Desktop/projectEL/frontend/src/components/ChatCard.tsx) 的标题栏右侧会增加一个 🎚️ **“参数”** 展开按钮。点击后，直接在 `ChatCard` 内部右侧滑出一个**卡片内侧面板抽屉 (Inside-Card Drawer)**，供用户就地配置当前会话。

### 2.4 聊天框 Slash Command (/) 与 Skill 激活机制
为提升交互效率并实现类似 Antigravity 的操作体验，系统在输入胶囊上方集成了 Slash Command 联想功能：
*   **唤起与联想面板**：当用户在输入框键入 `/` 时（或首字母为 `/`），输入框上方会弹出一个悬浮式毛玻璃卡片联想菜单（基于 Shadcn `Command` Primitives 原理）。
*   **选项列表与检索**：
    *   **系统命令 (Commands)**：提供基础快捷操作，如 `/clear`（清空会话）与 `/help`（显示帮助）。
    *   **画布技能 (Skills/Workflows)**：动态请求后端 `/api/workflows` 接口，列出所有已保存或编译的技能（如 `/skill socratic-quiz`、`/skill ai-news-briefing`），支持全文拼音过滤与键盘/鼠标选取。
*   **执行与激活行为**：
    *   **选中系统命令**：直接触发前端/后端业务（如 `/clear` 直接触发清空 Socket 会话历史）。
    *   **选中技能命令**：自动在输入框中补全 `/skill <skillId> ` 并直接提交。后端解析出 `skillId` 后，会读取对应编译出的 `SKILL.md` 规则，作为 System Context 前缀隐式注入大模型会话，从而完成技能挂载。
*   **激活状态反馈 (Skill Badge)**：
    *   当技能被激活时，聊天视窗右上角将高亮渲染一个磨砂透光的**活动技能状态徽章**（例如：`Active Skill: daily-briefing (x)`）。用户点击 `(x)` 可以发出退载事件，清理当前挂载的技能规则，重置对话环境。

---

## 3. Tailwind CSS & Shadcn UI 基础集成规范

### 3.1 依赖安装
在 `frontend` 子目录下安装核心模块：
```bash
npm install -D tailwindcss@3.4.1 postcss autoprefixer
npx shadcn-ui@latest init  # 选择 TS、Default、Slate、CSS 变量
```

### 3.2 变量与全局样式整合
在 `frontend/tailwind.config.js` 中将 CSS 主题变量绑定至 Tailwind 实用类：
```javascript
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        background: "hsl(var(--background))",
        panel: "hsl(var(--panel-bg))",
        primary: "hsl(var(--primary))",
      }
    }
  }
}
```
在 `frontend/src/index.css` 顶部 prepended 引入：
```css
@tailwind base;
@tailwind components;
@tailwind utilities;
```

### 3.3 Shadcn UI 组件改造
所有 Shadcn UI 原子组件（放置于 `components/ui/`）导入后需做微改，使其贴合玻璃材质：
*   **移除不透光硬边框**：将默认的浅灰色 `border` 替换为发光半透明边框 `border-white/8` (深色) 或 `border-black/6` (亮色)。
*   **添加毛玻璃类**：在 `DialogContent`、`PopoverContent` 等弹出层容器中添加 `bg-panel backdrop-blur-md`，以保障视窗背景穿透磨砂效果。

---

## 4. Electron 桌面封装架构 (Electron Sidecar Process)

桌面端应用采用“主窗口（桌面窗口守护） + 后端子进程（Express API 侧车）”的混合进程架构。

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

### 4.1 核心进程控制 (`main.ts`)
主进程运行在 `frontend/electron/main.ts` 中，使用 `spawn` 调起 Node 后端子进程：
```typescript
import { app, BrowserWindow } from 'electron';
import { spawn, ChildProcess } from 'child_process';
import path from 'path';

let backendProcess: ChildProcess | null = null;

function startBackend() {
  const isDev = !app.isPackaged;
  const backendPath = isDev 
    ? path.join(__dirname, '../../backend/src/server.ts') 
    : path.join(process.resourcesPath, 'app.asar.unpacked/backend/dist/server.js');

  const cmd = isDev ? 'npx' : 'node';
  const finalArgs = isDev ? ['tsx', backendPath] : [backendPath];

  backendProcess = spawn(cmd, finalArgs, {
    cwd: isDev ? path.join(__dirname, '../../backend') : path.join(process.resourcesPath, 'app.asar.unpacked/backend'),
    shell: true,
  });
}
```

### 4.2 退出守护与进程清空
为防止 Electron 异常退出或关闭导致后台 Express 端口残留变成僵尸进程，系统实现双重退出守护：
1.  **Electron 主进程端**：
    监听主进程退出事件，在 `window-all-closed` 和 `will-quit` 事件中显式向子进程发送终止信号：
    ```typescript
    if (backendProcess) backendProcess.kill('SIGINT');
    ```
2.  **Express 后端端**：
    在 `backend/src/server.ts` 中，后端周期性（如每 5 秒）轮询 `process.parent` 是否存活，若检测到父进程（Electron 主进程）消失，则自动执行安全退出流程：
    ```typescript
    setInterval(() => {
      if (!process.connected) {
        console.log("Parent process disconnected, exiting...");
        process.exit(0);
      }
    }, 5000);
    ```

### 4.3 预加载安全桥接 (`preload.ts`)
在 `frontend/electron/preload.ts` 中通过 `contextBridge` 注入安全的 IPC 桥接：
```typescript
import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electronAPI', {
  send: (channel: string, data: any) => ipcRenderer.send(channel, data),
  on: (channel: string, callback: (...args: any[]) => void) => {
    ipcRenderer.on(channel, (event, ...args) => callback(...args));
  }
});
```

---

## 5. Windows 平台打包与绿色分发指南

### 5.1 方案一：使用 `electron-builder` 编译桌面程序
直接在根目录配置 `electron-builder`，生成标准的 EXE 安装包。
*   **配置文件配置 (`package.json`)**：
    ```json
    {
      "build": {
        "appId": "com.snapshot-pi.app",
        "productName": "Snapshot Pi",
        "files": [
          "main.js",
          "backend/dist/**/*",
          "backend/node_modules/**/*",
          "frontend/dist/**/*",
          "pi-sdk/**/*",
          "package.json"
        ],
        "extraResources": [
          { "from": "napcat", "to": "napcat", "filter": ["**/*"] }
        ],
        "win": { "target": ["nsis", "zip"] }
      }
    }
    ```
*   **打包流程**：
    1. 编译前后端源码：`npm run build --prefix backend` 和 `npm run build --prefix frontend`。
    2. 执行 Electron 打包：`npx electron-builder`。

### 5.2 方案二：Pkg 打包后端 (轻量级，浏览器访问)
如果不需要桌面 GUI 视窗，只希望将后端编译成无命令行黑框的后台程序，让用户使用物理浏览器访问 `http://localhost:3000`：
1. 全局安装 `pkg`：`npm install -g pkg`。
2. 调整托管前端静态文件的相对路径指向 `process.cwd()` 而不是 `__dirname`。
3. 执行打包：
   ```bash
   pkg package.json --targets node18-win-x64 --out-path ./dist_bin
   ```
   *注意：打包后生成的 `.exe` 必须与原生二进制模块 `wrapper.node`、`napcat` 运行时文件夹以及前端 `frontend/dist` 放置在相同目录下。*

### 5.3 方案三：一键启动“绿色版” + 批处理转 EXE (最稳定分发)
适用于包含 Puppeteer、NapCat 等大型第三方环境时的物理部署。
1.  **构造绿色免安装文件夹** `snapshot_pi_release`：
    *   `node/`：放置官方绿色版解压的 Node.js 运行环境 (含 `node.exe`)。
    *   `snapshot-pi/`：存放已经 build 且瘦身（剔除 devDependencies）的完整源码。
    *   `start-launcher.bat`：编写根级启动脚本。
2.  **编写 `start-launcher.bat`**：
    ```batch
    @echo off
    set PATH=%~dp0node;%PATH%
    cd /d "%~dp0snapshot-pi"
    start.bat
    ```
3.  **转为二进制 Launcher**：
    使用 **Bat To Exe Converter** 将 `start-launcher.bat` 编译为 `SnapshotPi.exe`，勾选 "Invisible" 隐藏 CMD 命令行黑窗，并绑定系统托盘图标。
4.  **打包分发**：
    使用 **Inno Setup** 编译器将整个 `snapshot_pi_release` 文件夹编译打包成一个单体 `setup.exe` 安装文件。
