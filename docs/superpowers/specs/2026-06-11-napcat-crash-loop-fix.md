# NapCat 崩溃循环修复 — 设计规格

> 日期: 2026-06-11 | 状态: 就绪

---

## 一、问题描述

NapCat Shell 启动后立即退出 (code=1)，被服务端守护进程检测为异常退出后自动重启，形成崩溃循环：
```
NapCat 启动 → code=1 退出 → 5s 后重启 → 再次退出 → 15s 后重启 → 退出 → 30s 后重启 → 禁用
```

共 3 次重启机会用尽后被标记为 `enabled: false`。

## 二、根因分析

| 因素 | 详情 |
|------|------|
| **主因** | `wrapper.node`（5月18日构建）与 `napcat.mjs`（5月15日构建）版本不匹配 — 架构文档已知问题 #1 |
| **次因** | Per-UIN 配置文件 (`onebot11_3970918605.json`) 使用旧的 WS 客户端名 "projectEL"，与基配 "Snapshot Pi" 不一致 |
| **诱因** | 项目重构扁平化 `napcat/` 目录后未重新运行 setup，二进制文件来自不同的 NapCat 发行版 |

NapCat 退出时无 stdout/stderr 输出，表明崩溃发生在 Node.js 原生模块加载阶段（`wrapper.node` dlopen 失败），而非 JS 层面。

## 三、修复方案

### 核心策略

重新运行 `setup-napcat.ps1 -Force`，从 GitHub Release 下载 **NapCat.Shell.zip v4.18.4**，使 `wrapper.node`、`napcat.mjs`、`QQNT.dll` 等全部来自同一次构建。

### 文件处理矩阵

| 操作 | 文件 | 机制 |
|------|------|------|
| 🔒 保护 | `napcat.bat`, `index.cjs`, `config.json`, `package.json`, `KillQQ.bat` | `$ProtectedFiles` 注入模式过滤 |
| 🔒 保护 | `qqnt.json` | 新增到 `$ProtectedFiles`（自定义文件） |
| 💾 备份恢复 | `config/onebot11.json` | Copy-NapCatCore 前备份、后恢复 |
| 🗑️ 清理 | `config/onebot11_*.json`, `config/napcat_*.json` | 部署前手动删除，让 NapCat 从基准配置重新生成 |
| ⚠️ 覆盖 | `wrapper.node`, `napcat.mjs`, `major.node`, `QQNT.dll`, 其他 DLL | 来自官方 Zip |

### 执行步骤

1. **确认 `qqnt.json` 来源** — 检查是否为自定义文件，如是则加入 `$ProtectedFiles`
2. **清理 per-UIN 配置** — 删除 `config/onebot11_*.json` 和 `config/napcat_*.json`，保留基准配置
3. **运行重新部署** — `powershell -ExecutionPolicy Bypass -File scripts\setup-napcat.ps1 -Force`
4. **验证 `onebot11.json`** — 确认 WS URL 为 `ws://127.0.0.1:3001/qq/ws`，token 正确
5. **启动验证** — 运行 `start.bat`，确认 NapCat 正常启动并建立 WebSocket 连接

## 四、验证标准

- [ ] NapCat 进程启动后持续运行超过 30 秒（不再 code=1 退出）
- [ ] NapCat 成功连接到 `ws://127.0.0.1:3001/qq/ws`
- [ ] 服务端日志显示 `[QQ]` 连接成功，无错误级别日志
- [ ] QQ Bot 能正常收发群消息

## 五、长期预防

- 每次修改 `napcat/` 目录结构或升级 NapCat 版本后，必须运行 `setup-napcat.ps1 -Force` 确保二进制一致性
- 在 `setup-napcat.ps1` 的 `Test-Deployment` 中增加 `wrapper.node` 与 `napcat.mjs` 版本校验
- 将 `qqnt.json` 加入 `$ProtectedFiles` 列表
