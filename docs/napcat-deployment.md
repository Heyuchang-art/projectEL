# NapCat QQ Bot 部署指南

> 基于 NapCat 官方推荐规则，napcat/ 完全隔离于 git 仓库

---

## 快速开始

```batch
:: 1. 克隆项目
git clone <repo> && cd projectEL

:: 2. 安装依赖
npm install

:: 3. 首次部署 NapCat（下载 NapCat.Shell.Windows.Node.zip + 解压 + 配置模板）
powershell -NoProfile -ExecutionPolicy Bypass -File "scripts\setup-napcat.ps1"

:: 4. 启动服务
start.bat

:: 5. 打开浏览器 http://localhost:5173
::    点击 QQ Bot 卡片上的"启动"按钮
```

---

## 目录说明

| 目录 | git 追踪 | 说明 |
|------|----------|------|
| `config/napcat-templates/` | ✅ 是 | 配置模板（onebot11 / napcat / webui） |
| `napcat/` | ❌ 否 | 运行时目录，由 `setup-napcat.ps1` 从 `NapCat.Shell.Windows.Node.zip` 自动部署 |
| `napcat/napcat/config/` | ❌ 否 | 实际配置文件，从模板复制 |
| `scripts/setup-napcat.ps1` | ✅ 是 | 部署脚本 |

---

## 配置修改

### 方式一：编辑模板（推荐用于项目级变更）

编辑 `config/napcat-templates/*.json` → 提交 git → 其他开发者 pull 后运行 `scripts\setup.bat`

### 方式二：WebUI 在线修改（推荐用于个人定制）

1. 启动 QQ Bot 后访问 `http://127.0.0.1:6099/webui`
2. 扫码登录（首次启动时日志会显示 token）
3. 修改网络配置、插件等
4. 修改保存在 `napcat/napcat/config/`（不被 git 追踪）

---

## 重新部署

```batch
:: 完全重建 napcat/（清空后重装）
powershell -NoProfile -ExecutionPolicy Bypass -File "scripts\setup-napcat.ps1" -Force
```

**注意**：`--force` 会清空整个 `napcat/` 目录，包括 WebUI 修改的配置和安装的插件。如要保留，请先用 WebUI 导出配置。

---

## 端口说明

| 端口 | 服务 | 说明 |
|------|------|------|
| 3000 | 后端 Express API | Snapshot Pi 后端 |
| 3001 | WebSocket 服务端 | NapCat 连接此端口推送消息 |
| 5173 | 前端 Vite | Snapshot Pi WebUI |
| 6099 | NapCat WebUI | NapCat 自带的 Web 管理面板 |

---

## 常见问题

### Q: 启动 QQ Bot 提示"NapCat 未安装"

运行 `scripts\setup.bat` 完成首次部署。

### Q: 启动后 NapCat 闪退

查看 `napcat/logs/` 下的日志文件。常见原因：
- `onebot11.json` 中 WebSocket URL 不正确
- 端口 3001 被占用
- `wrapper.node` 版本不匹配

### Q: git status 显示 napcat/ 下的文件

检查 `.gitignore` 中是否有 `napcat/` 规则。如果 napcat 之前被 git 追踪，需运行：
```batch
git rm -r --cached napcat/
```

### Q: NapCat 目录下有大量临时文件/空目录

这是 QQ NT (Electron/Chromium) 运行时的正常行为。由于 `napcat/` 已被 `.gitignore` 屏蔽，不影响 git。如需清理：
```batch
:: 重启 NapCat 后临时文件通常自动清理
:: 或手动清理（确保 QQ Bot 已停止）
rmdir /s /q napcat\
scripts\setup.bat
```

---

## 与官方文档的关系

本部署基于 [NapCat 官方文档](https://napneko.github.io) 的 Shell 模式。核心差异：
- **官方**：NapCat 独立目录，手动启动
- **本项目**：NapCat 在项目子目录（git ignore），后端自动 spawn 管理生命周期

配置格式、WebUI 使用、OneBot 协议均与官方保持一致。

## 相关文档

- [QQ Bot 架构文档](qq-bot-architecture.md) — 完整系统架构
- [部署重设计 Spec](superpowers/specs/2026-06-11-napcat-deployment-redesign.md) — 设计决策记录
