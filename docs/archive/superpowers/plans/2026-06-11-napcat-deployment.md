# NapCat QQ Bot 部署计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 部署 NapCat QQ Shell 到 `napcat/` 目录，使 QQ Bot 可以通过 WebUI 启动。

**Architecture:** 运行 `scripts/setup-napcat.ps1`（568 行 PowerShell 脚本），该脚本分 5 步执行：下载 NapCat Shell zip → 从 QQNT 安装包提取原生二进制文件 → 清理多余文件 → 从 `config/napcat-templates/` 部署配置模板 → 验证完整性。`napcat/` 目录最终完全自包含，可整体复制到其他 Windows 机器。

**Tech Stack:** PowerShell 5.1+, NapCatQQ v4.18.4, QQNT 9.9.26-44343

---

## 前置条件

- `server.ts` 已修复（`spawn` 导入 + `NapCatGuardState` 已恢复）✅
- Windows 10+ 操作系统
- 网络连接（下载约 250-350MB）
- 磁盘空间约 1GB（含 QQNT 安装包临时缓存）

---

## 部署概览

部署脚本 `scripts/setup-napcat.ps1` 执行 5 个步骤：

| 步骤 | 操作 | 下载量 | 耗时（估算） |
|------|------|--------|-------------|
| 1 | 下载 NapCat.Shell.zip | ~50-150MB | 1-3 分钟 |
| 2 | 下载 QQNT 安装包 + 提取 wrapper.node/DLLs | ~200MB | 3-5 分钟 |
| 3 | 清理多余文件（非 Windows 原生模块、过期 chunk） | 0 | <10 秒 |
| 4 | 从 `config/napcat-templates/` 复制配置到 `napcat/config/` | 0 | <5 秒 |
| 5 | 验证部署完整性（6 个关键文件 + JSON 结构校验） | 0 | <5 秒 |

**总计：约 5-10 分钟**（取决于网速）

---

### Task 1: 运行 NapCat 部署脚本

**文件:**
- 创建: `napcat/` 整个目录（含 `node.exe`, `wrapper.node`, `napcat.mjs`, `config/`, `native/`, `plugins/`, `static/`, `worker/` 等）
- 读取: `config/napcat-templates/onebot11.json` → 复制到 `napcat/config/onebot11.json`
- 读取: `config/napcat-templates/napcat.json` → 复制到 `napcat/config/napcat.json`
- 读取: `config/napcat-templates/webui.json` → 复制到 `napcat/config/webui.json`

- [ ] **Step 1: 运行部署脚本**

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File "scripts\setup-napcat.ps1"
```

> **不用 `-Force`**：首次部署不需要 `-Force`。`-Force` 仅用于重新部署（会清空现有 `napcat/` 后重装）。

**脚本具体行为：**

1. **下载 NapCat.Shell.zip**：优先从 `gh-proxy.com` 代理下载，失败则回退到 GitHub 直连。解压后扁平化目录结构（`napcat/` 子目录内容提升到根目录），跳过注入模式专属文件（`NapCatWinBootMain.exe`、`loadNapCat.js` 等）

2. **提取 QQNT 原生二进制**：从 `config.json` 读取目标 QQNT 版本（默认 `9.9.26-44343`），下载对应 QQNT 安装包（`QQ9.9.26.44343_x64.exe`，约 200MB），用 7za 解包并提取：
   - 关键文件：`wrapper.node`、`major.node`
   - DLL 依赖：`QBar.dll`、`LightQuic.dll`、`broadcast_ipc.dll`、`libglib-2.0-0.dll`、`libgobject-2.0-0.dll`、`libvips-42.dll`、`ncnn.dll`、`opencv.dll`、`avif_convert.dll`
   - 系统 DLL：`QQNT.dll`
   - 提取完成后清理安装包（释放约 200MB）

3. **清理多余文件**：删除 Darwin/Linux 原生模块（`.darwin.*.node`、`.linux.*.node`）、`index.html` 未引用的过期 hash chunk、缓存 png、日志文件

4. **部署配置模板**：从 git 追踪的 `config/napcat-templates/` 复制 3 个 JSON 配置文件到 `napcat/config/`，复制前验证每个模板是合法 JSON

5. **验证完整性**：检查 6 个关键文件是否存在：
   - `node.exe` — Node.js 运行时
   - `wrapper.node` — QQNT Wrapper 原生模块
   - `napcat.mjs` — NapCat 核心
   - `config/onebot11.json` — OneBot v11 配置（含 `ws://127.0.0.1:3001/qq/ws`）
   - `napcat.bat` — Shell 入口
   - `index.cjs` — 自定义启动器

- [ ] **Step 2: 检查输出，确认 6 项全部 [OK]**

预期输出：
```
========================================
  Deployment complete! napcat/ is self-contained
  -> Run napcat.bat to start
  -> The entire napcat/ dir can be copied to any Windows machine
========================================
```

- [ ] **Step 3: 验证 napcat/ 目录结构**

```powershell
ls napcat/node.exe, napcat/wrapper.node, napcat/napcat.mjs, napcat/config/onebot11.json
```

预期：4 个文件全部存在。

- [ ] **Step 4: 验证 onebot11.json WebSocket 配置**

```powershell
Get-Content napcat/config/onebot11.json | ConvertFrom-Json | Select-Object -ExpandProperty network | Select-Object -ExpandProperty websocketClients
```

预期：显示 `name: "Snapshot Pi"`, `url: "ws://127.0.0.1:3001/qq/ws"`, `enable: true`。

---

### Task 2: 启动验证

部署完成后，通过 WebUI 启动 QQ Bot 进行端到端验证。

- [ ] **Step 1: 启动后端服务**

```bash
cd backend && npx tsx src/server.ts
```

预期输出包含：
```
[QQ] Config loaded and adapter auto-started
Server running at http://localhost:3000
```

- [ ] **Step 2: 调用 API 启动 QQ Bot**

```bash
curl -X POST http://localhost:3000/api/qq/start
```

预期返回：
```json
{"success": true, "message": "QQ 服务已启动"}
```

此时 NapCat Shell 窗口会自动弹出，提示扫码登录 QQ。

- [ ] **Step 3: 检查 QQ 状态**

```bash
curl http://localhost:3000/api/qq/status
```

部署后首次启动，预期显示 NapCat 已连接但尚未登录（`online: false`），扫码登录后会变为 `online: true`。

---

## 风险和注意事项

| 风险 | 缓解措施 |
|------|----------|
| GitHub 下载慢/失败 | 脚本自动先走 `gh-proxy.com` 代理，失败回退直连 |
| QQNT 安装包 200MB 下载慢 | 安装包缓存到 `%TEMP%`，重复部署不重复下载 |
| wrapper.node 版本不匹配 | 脚本从 `config.json` 读取期望的 QQNT 版本，自动下载对应安装包 |
| 端口 3001 被占用 | 部署前确保 3001 端口空闲：`netstat -ano | findstr 3001` |
| 部署中途失败 | 重跑脚本即可（已下载的安装包会被缓存），或 `-Force` 完全重建 |

---

## 部署后 napcat/ 目录结构

```
napcat/
├── node.exe              # 嵌入式 Node.js 运行时
├── wrapper.node          # QQNT Wrapper 原生模块 (关键)
├── major.node            # Wrapper 辅助模块
├── napcat.mjs            # NapCat 核心入口
├── napcat.bat            # Shell 启动入口
├── index.cjs             # 自定义启动器（wrapper.node 智能定位）
├── config.json           # NapCat 版本配置
├── package.json          # 依赖声明
├── qqnt.json             # QQNT 版本锁定
├── KillQQ.bat            # 强制终止 QQ 进程
├── config/
│   ├── onebot11.json     # OneBot v11 WS 客户端配置（从模板部署）
│   ├── napcat.json       # NapCat 日志/调试配置（从模板部署）
│   └── webui.json        # WebUI 面板配置（从模板部署）
├── native/               # 原生模块（仅保留 Windows）
├── plugins/              # NapCat 插件
├── static/               # WebUI 前端静态资源
└── worker/               # Worker 线程
```
