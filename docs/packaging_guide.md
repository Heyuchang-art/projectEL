# Snapshot Pi 项目打包为 EXE 部署指南

本指南详细介绍了如何将 `Snapshot Pi` 系统（包含 React 前端、Express 后端、Pi SDK 内核及 NapCat 机器人）打包为 Windows 平台下独立运行的 `.exe` 可执行文件。

由于项目中包含大量的**原生 C++ 模块**（如 `wrapper.node`、`sharp.node`）以及**外部子进程依赖**（如 Puppeteer 浏览器、NapCat QQ 核心），传统的单文件打包工具（如 `pkg`）在处理动态路径和二进制加载时会有局限。

以下推荐三种打包方案，您可以根据分发需求进行选择。

---

## 方案一：使用 Electron 封装为桌面客户端 (推荐，原生 GUI 体验)

通过将 React 前端与 Express 后端打包进 Electron 容器，可以生成一个标准的 Windows 安装程序或绿色版 `.exe`。

### 1. 安装依赖
在根目录安装 Electron 相关的开发依赖：
```bash
npm install electron electron-builder concurrently --save-dev
```

### 2. 编写 Electron 主进程入口 (`main.cjs`)
在项目根目录下创建 `main.cjs`，用于管理后端服务的生命周期和桌面窗口：

```javascript
const { app, BrowserWindow } = require('electron');
const path = require('path');
const { fork } = require('child_process');

let backendProcess = null;
let mainWindow = null;

function startBackend() {
  // 启动 Express 后端网关 (fork 机制可以完美共享 Node 运行环境并解决路径问题)
  const serverPath = path.join(__dirname, 'backend/dist/server.js'); // 确保后端已 build
  backendProcess = fork(serverPath, [], {
    env: { ...process.env, NODE_ENV: 'production' }
  });

  backendProcess.on('error', (err) => {
    console.error('Backend process error:', err);
  });
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    title: "Snapshot Pi 智能辅助学习系统",
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
    },
    icon: path.join(__dirname, 'frontend/public/icon.ico') // 需准备图标
  });

  // 生产环境下，等待后端启动后加载页面
  // 前端 Vite 静态资源已由 Express 的 express.static 托管
  mainWindow.loadURL('http://localhost:3000'); 

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(() => {
  startBackend();
  // 稍作延迟等待 Express 端口启动
  setTimeout(createWindow, 1000);
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    if (backendProcess) backendProcess.kill();
    app.quit();
  }
});
```

### 3. 配置 `package.json` 中的打包参数
在根目录的 `package.json` 中配置 `electron-builder`：

```json
{
  "main": "main.cjs",
  "scripts": {
    "build:all": "npm run build --workspace=backend && npm run build --workspace=frontend",
    "dist": "electron-builder"
  },
  "build": {
    "appId": "com.snapshot-pi.app",
    "productName": "Snapshot Pi",
    "directories": {
      "output": "dist_electron"
    },
    "files": [
      "main.cjs",
      "backend/dist/**/*",
      "backend/node_modules/**/*",
      "frontend/dist/**/*",
      "pi-sdk/**/*",
      "napcat/**/*", // 将 NapCat 资源作为二进制依赖打包进去
      "package.json"
    ],
    "extraResources": [
      {
        "from": "napcat",
        "to": "napcat",
        "filter": ["**/*"]
      }
    ],
    "win": {
      "target": ["nsis", "zip"],
      "icon": "frontend/public/icon.ico"
    },
    "nsis": {
      "oneClick": false,
      "allowToChangeInstallationDirectory": true,
      "shortcutName": "Snapshot Pi"
    }
  }
}
```

### 4. 打包命令
1. 编译前后端源码：`npm run build:all`
2. 运行打包：`npm run dist`
生成的安装包将存放在 `dist_electron/` 目录下。

---

## 方案二：使用 Pkg 打包后端 + 外部资源 (轻量级，浏览器访问)

如果您不需要桌面窗口，只想将后端编译为一个无控制台黑框的后台 `.exe`，并让用户通过浏览器访问 `http://localhost:3000`。

### 1. 安装 Pkg
```bash
npm install -g pkg
```

### 2. 调整静态资源路径
确保在 `backend/src/server.ts` 中，托管前端的静态代码路径使用相对或动态的 `path.join(process.cwd(), 'frontend/dist')`，而不是 `__dirname`。因为 Pkg 会将代码打包进虚拟文件系统（`/snapshot`），外部的物理资源需使用 `process.cwd()` 访问。

### 3. 进行 Pkg 打包
在 `backend/` 目录下执行编译命令，生成 Windows 的 `.exe`：
```bash
pkg package.json --targets node18-win-x64 --out-path ./dist_bin
```
*(注意：需要将本地的 `wrapper.node` 等二进制模块、`napcat` 文件夹、`frontend/dist` 文件夹放置在生成的 `.exe` 相同目录下。)*

---

## 方案三：制作一键启动“绿色版” + 批处理转 EXE (极简且最稳定)

对于包含 Puppeteer 浏览器和独立 Node.js 的复杂项目，使用**自解压安装包 (SFX)** 或**Inno Setup** 制作“集成运行时的绿色安装包”是最稳定且不易出错的方案。

### 1. 准备集成环境文件夹
新建一个 `snapshot_pi_release` 文件夹，结构如下：
```
snapshot_pi_release/
├── node/               # 拷贝本地的 Node.js 绿色版安装目录 (含 node.exe)
├── snapshot-pi/        # 项目完整源码 (已执行 npm run build 且去除 devDependencies)
│   ├── backend/
│   ├── frontend/
│   ├── napcat/
│   └── start.bat
└── snapshot-pi.bat     # 根目录快速启动脚本
```

### 2. 编写根目录启动脚本 `snapshot-pi.bat`
```bat
@echo off
set PATH=%~dp0node;%PATH%
cd /d "%~dp0snapshot-pi"
start.bat
```

### 3. 将 `.bat` 转换为 `.exe`
使用开源的 **Bat To Exe Converter** 或 **Rust/Go 编写一个简单的 Launcher**：
* 作用：双击 `snapshot-pi.exe` 时，静默调用内置的 `node/node.exe` 并启动服务，隐藏 CMD 的黑色窗口，同时在系统右下角托盘展示图标。
* 这样用户无需在电脑上预装 Node.js，真正实现解压即用。

### 4. 使用 Inno Setup 制作安装包
1. 下载并安装 [Inno Setup](https://jrsoftware.org/isinfo.php)。
2. 使用 Wizard 向导，选择刚才的 `snapshot_pi_release` 文件夹作为主程序目录，将编译好的 `snapshot-pi.exe` 设为启动主程序。
3. 编译后即可生成一个标准的 `setup.exe` 安装文件，安装时会自动创建桌面快捷方式。
