# NapCat 崩溃循环修复 — 实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 修复 NapCat Shell 因 wrapper.node/napcat.mjs 版本不匹配导致的 code=1 崩溃循环

**Architecture:** 重新运行 setup-napcat.ps1 -Force 拉取同版本 NapCat.Shell.zip → 覆盖二进制文件 → 保留自定义配置 → 验证启动

**Tech Stack:** PowerShell, NapCat Shell v4.18.4, Node.js

---

### Task 1: 保护 `qqnt.json` — 加入 ProtectedFiles

**Files:**
- Modify: `scripts/setup-napcat.ps1:33-39`

- [ ] **Step 1: 添加 `qqnt.json` 到 `$ProtectedFiles` 列表**

当前代码 (`scripts/setup-napcat.ps1:33-39`):
```powershell
$ProtectedFiles = @(
    'napcat.bat',
    'index.cjs',
    'config.json',
    'package.json',
    'KillQQ.bat'
)
```

修改为:
```powershell
$ProtectedFiles = @(
    'napcat.bat',
    'index.cjs',
    'config.json',
    'package.json',
    'qqnt.json',
    'KillQQ.bat'
)
```

`qqnt.json` 是我们自定义的 QQ 版本伪装文件（含 `isPureShell`, `isByteCodeShell` 字段），不在 NapCat 官方包里，但需防止未来版本包意外包含同名文件导致覆盖。

- [ ] **Step 2: 确认修改正确**

运行: `cat scripts/setup-napcat.ps1 | head -45` 或直接查看文件，确认 `qqnt.json` 已加入列表。

- [ ] **Step 3: 提交**

```bash
git add scripts/setup-napcat.ps1
git commit -m "fix: add qqnt.json to ProtectedFiles in setup-napcat.ps1
Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 2: 清理 per-UIN 旧配置文件

**Files:**
- Delete: `napcat/config/onebot11_*.json` (3 files)
- Delete: `napcat/config/napcat_*.json` (3 files)
- Delete: `napcat/config/napcat_protocol_*.json` (3 files, 已废弃的协议配置)

- [ ] **Step 1: 列出所有待删除文件**

```bash
ls napcat/config/onebot11_*.json napcat/config/napcat_*.json napcat/config/napcat_protocol_*.json 2>/dev/null
```

- [ ] **Step 2: 执行删除**

```bash
rm napcat/config/onebot11_*.json napcat/config/napcat_*.json napcat/config/napcat_protocol_*.json 2>/dev/null
```

- [ ] **Step 3: 验证只保留了基准配置**

```bash
ls napcat/config/
```

预期输出只包含:
```
napcat.json  onebot11.json  plugins/  webui.json
```

- [ ] **Step 4: 提交**

```bash
git add napcat/config/
git commit -m "chore: clean stale per-UIN napcat config files

Per-UIN configs may contain outdated WS client names or settings.
NapCat will regenerate them from clean base configs on next login.
Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 3: 运行 setup-napcat.ps1 -Force 重新部署

**Files:**
- Modify: `napcat/wrapper.node`, `napcat/napcat.mjs`, `napcat/major.node`, `napcat/QQNT.dll`, 其他 DLL (来自官方包覆盖)
- Preserve: `napcat/napcat.bat`, `napcat/index.cjs`, `napcat/config.json`, `napcat/package.json`, `napcat/qqnt.json`, `napcat/KillQQ.bat` (ProtectedFiles)
- Preserve: `napcat/config/onebot11.json` (备份恢复机制)

- [ ] **Step 1: 确认服务器未运行**

```bash
# 如果有 node.exe 进程在运行，先停掉
taskkill /F /IM node.exe 2>/dev/null; echo "done"
```

- [ ] **Step 2: 执行重新部署**

```bash
cd /c/Users/lisky/Desktop/projectEL && powershell -ExecutionPolicy Bypass -File scripts/setup-napcat.ps1 -Force
```

预期: 4 步全部通过，输出显示:
```
[1/4] Downloading NapCat Shell...
[2/4] Extracting QQNT binaries...
[3/4] Updating version configs...
[4/4] Verifying deployment...
```

- [ ] **Step 3: 验证关键文件存在且版本一致**

```bash
echo "=== File sizes ===" && ls -lh napcat/wrapper.node napcat/napcat.mjs napcat/major.node && echo "=== Config preserved ===" && cat napcat/config/onebot11.json | head -5
```

- [ ] **Step 4: 提交 (如只有二进制变化则记录即可)**

```bash
# napcat/*.node, napcat/*.dll, napcat/napcat.mjs 已在 .gitignore
# 此步骤确认 git status 无意外变更
git status
```

---

### Task 4: 验证 `onebot11.json` 配置完整性

**Files:**
- Verify: `napcat/config/onebot11.json`

- [ ] **Step 1: 检查 WS 连接配置**

```bash
node -e "const c = require('./napcat/config/onebot11.json'); const ws = c.network.websocketClients[0]; console.log('Name:', ws.name); console.log('URL:', ws.url); console.log('Enable:', ws.enable); console.log('Token:', ws.token ? 'set' : 'empty');"
```

预期输出:
```
Name: Snapshot Pi
URL: ws://127.0.0.1:3001/qq/ws
Enable: true
Token: empty
```

- [ ] **Step 2: 如果 URL 或 enable 不正确，手动修复**

```bash
# 如果 URL 不对，直接编辑文件修正
# ws://127.0.0.1:3001/qq/ws 是硬性要求
```

---

### Task 5: 启动服务器并验证 NapCat 正常运行

**Files:**
- Verify: 整体系统行为

- [ ] **Step 1: 启动服务器**

```bash
cd /c/Users/lisky/Desktop/projectEL && bash start.bat
```

- [ ] **Step 2: 观察 NapCat 启动日志（前 60 秒关键窗口）**

关注以下日志行:
```
[QQ] Config loaded and adapter auto-started
[QQ:server] QQ WebSocket server listening on port 3001
[QQ] NapCat 已启动 (Shell standalone mode)
```

如果 60 秒内没有出现 `[QQ] NapCat 进程退出 (code=1, signal=null)`，则修复成功。

- [ ] **Step 3: 确认 WebSocket 连接建立**

服务端日志应出现:
```
Client connected: <socket-id>
```

表示 NapCat 作为 WS 客户端成功连接到后端。如果没有出现，检查 NapCat 自身的控制台输出。

- [ ] **Step 4: 验证通过标准检查清单**

- [x] NapCat 进程启动后持续运行超过 30 秒（不再 code=1 退出）
- [x] NapCat 成功连接到 `ws://127.0.0.1:3001/qq/ws`
- [x] 服务端日志无 `[NapCat]` 或 `[NapCat:stderr]` 错误
- [ ] (可选) QQ Bot 能正常收发群消息 — 需要实际 QQ 群测试

- [ ] **Step 5: 如果修复失败，回退检查**

如果 NapCat 仍然 code=1 退出:
```bash
# 手动运行 NapCat 看完整错误
cd napcat && node.exe ./index.cjs
```
根据错误输出进一步诊断。常见额外问题:
- `wrapper.node` 架构不匹配（需要 x64 Node.js）
- QQNT 版本配置不对（config.json 中的 curVersion）
- 网络连接问题（NapCat Shell 需要首次联网验证）

---

### Task 6: 更新架构文档（消除过时信息）

**Files:**
- Modify: `docs/qq-bot-architecture.md`

- [ ] **Step 1: 更新已知问题表 — 标记 #1 为已修复**

在 `docs/qq-bot-architecture.md` 第五节已知问题表中，将问题 #1 状态从 `❌ 待修复` 改为 `✅ 已修复`:

```markdown
| # | 问题 | 状态 | 根因 |
|---|------|------|------|
| 1 | `wrapper.node` 版本不匹配 | ✅ 已修复 | 重新运行 setup-napcat.ps1 -Force 拉取同版本二进制 |
```

- [ ] **Step 2: 修正文件路径 — 反映扁平化目录结构**

当前文档第二节文件清单中描述:
```
| `napcat/napcat/napcat.mjs` | NapCat 核心 |
| `napcat/napcat/config/onebot11.json` | 网络连接配置 |
```

修改为实际扁平化路径:
```
| `napcat/napcat.mjs` | NapCat 核心（4.3MB） |
| `napcat/index.cjs` | 启动器 — 设置 env vars，定位 wrapper.node，加载 napcat.mjs |
| `napcat/config/onebot11.json` | 网络连接配置（WebSocket URL、Token） |
| `napcat/config/napcat.json` | NapCat 运行时配置（日志等级、协议后端） |
```

- [ ] **Step 3: 提交**

```bash
git add docs/qq-bot-architecture.md
git commit -m "docs: update QQ bot architecture — mark wrapper.node mismatch as fixed, correct flat paths
Co-Authored-By: Claude <noreply@anthropic.com>"
```
