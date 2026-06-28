# NapCat 部署结构重设计 (NapCat Deployment Redesign)

> 状态: ✅ 已确认
> 日期: 2026-06-11
> 目标: 按 NapCat 官方推荐，将 napcat/ 从 git 仓库中完全隔离，消除 834 个临时目录污染

---

## 一、问题背景

### 1.1 现状

当前 `napcat/` 直接嵌在项目 git 仓库中作为子目录。QQ NT（基于 Electron/Chromium）以 `napcat/` 为工作目录运行，每次运行产生大量临时目录（TCD*.tmp、chrome_drag*、scoped_dir*、PSES-* 等），进程崩溃或异常退出后仅清除内容、留下空目录壳。

清理前统计：napcat/ 下 938 个条目，其中 834 个为空目录，11 个为 0 字节文件。

### 1.2 根因

NapCat 官方设计预期：**独立的工作目录**（如 `NapCat.XXXX.Shell/`），QQ NT 在工作目录下创建临时文件是正常的 Chromium/Electron 行为。当前将其嵌入 git 仓库违反了这一设计预期。

### 1.3 NapCat 官方文档依据

- Shell 手动版：解压目录即工作目录
- Linux Launcher/AppImage："缓存与 NapCat 位于当前工作目录"
- Docker 版：临时文件位于 `/app/.config/QQ/NapCat/temp`
- Windows 一键版：自动生成 `NapCat.XXXX.Shell` 独立目录

官方文档站: https://napneko.github.io
GitHub: https://github.com/NapNeko/NapCatQQ

---

## 二、设计目标

| # | 目标 | 度量 |
|---|------|------|
| 1 | napcat/ 完全隔离于 git | `git status` 不显示任何 napcat/ 下的文件 |
| 2 | 配置文件受版本控制 | `config/napcat-templates/` 在 git 中，部署时复制到 napcat |
| 3 | 一键部署 | `scripts/setup.bat` 自动下载、解压、部署模板 |
| 4 | 后端无硬编码路径 | `qq-bot-config.json` 中可配置 napcat 路径 |
| 5 | --force 完全重建 | 清空整个 napcat/ 后重装，不留残留 |

---

## 三、新目录结构

```
projectEL/
├── .gitignore                     ← napcat/ 全屏蔽
├── config/
│   ├── napcat-templates/          ← NEW: git 追踪的配置模板
│   │   ├── onebot11.json          ← OneBot WS 连接配置
│   │   ├── napcat.json            ← NapCat 运行时配置
│   │   └── webui.json             ← WebUI 端口/token
│   └── qq-bot-config.json         ← MOVED: 从根目录移入
├── scripts/
│   ├── setup-napcat.ps1           ← REFACTOR: 下载+解压+模板部署
│   ├── setup.bat                  ← 保持不变
│   └── ...
├── napcat/                        ← GITIGNORE: setup-napcat.ps1 自动生成
│   ├── napcat.bat                 ← 启动入口
│   ├── napcat/                    ← NapCat 核心
│   │   └── config/               ← 从 config/napcat-templates/ 复制
│   │       ├── onebot11.json
│   │       ├── napcat.json
│   │       └── webui.json
│   └── ... (QQ NT 运行时所有其他文件)
├── backend/
│   └── src/
│       └── qq-adapter.ts          ← 读取 config 确定 napcat 路径
└── docs/
    ├── qq-bot-architecture.md     ← UPDATED: 反映新结构
    ├── setup-fixes.md             ← UPDATED: 标记为历史文档
    └── napcat-deployment.md       ← NEW: 独立部署指南
```

---

## 四、.gitignore 设计

### 4.1 新规则

```gitignore
# NapCat: 整个目录由 setup-napcat.ps1 自动生成，不追踪
napcat/
```

### 4.2 删除的旧规则

以下 15 条规则不再需要，全部移除：

```gitignore
# 删除 ↓
napcat/node.exe
napcat/napcat.mjs
napcat/wrapper.node
napcat/major.node
napcat/QQNT.dll
napcat/*.dll
napcat/node_modules/
napcat/native/
napcat/static/
napcat/worker/
napcat/plugins/
napcat/cache/
napcat/logs/
napcat/*.db*
napcat/*.log
napcat/config/napcat_*.json
napcat/config/onebot11_*.json
napcat/config/napcat_protocol_*.json
napcat.zip
```

### 4.3 对比

| | 旧方案 | 新方案 |
|---|---|---|
| 规则数 | ~17 条 | 1 条 |
| 覆盖度 | 漏了 temp 目录 | 全覆盖 |
| 维护成本 | 每次 QQ 更新要加新规则 | 零维护 |

---

## 五、配置模板设计

### 5.1 `config/napcat-templates/onebot11.json`

```json
{
  "network": {
    "websocketClients": [
      {
        "name": "Snapshot Pi",
        "enable": true,
        "url": "ws://127.0.0.1:3001/qq/ws",
        "token": "",
        "messagePostFormat": "array",
        "reportSelfMessage": false,
        "reconnectInterval": 5000,
        "heartInterval": 30000
      }
    ]
  },
  "enableLocalFile2Url": true,
  "parseMultMsg": false
}
```

### 5.2 `config/napcat-templates/napcat.json`

```json
{
  "fileLog": true,
  "consoleLog": true,
  "fileLogLevel": "info",
  "consoleLogLevel": "info"
}
```

### 5.3 `config/napcat-templates/webui.json`

```json
{
  "host": "127.0.0.1",
  "port": 6099,
  "token": "",
  "loginRate": 3
}
```

### 5.4 部署流程

```
setup-napcat.ps1
  ├─ 1. 下载 NapCat.Shell.zip
  ├─ 2. 解压到 napcat/
  ├─ 3. Copy-Item config/napcat-templates/*.json → napcat/napcat/config/
  └─ 4. Test-OneBotConfig 验证 JSON 结构
```

首次启动时 NapCat 自动生成 `token` 并写回 `napcat/napcat/config/webui.json`（此文件不被 git 追踪）。

---

## 六、setup-napcat.ps1 重构

### 6.1 新执行流程

```
Step 1: 环境检查
  - 检查解压工具 (7za.exe / Expand-Archive)
  - 检查 Node.js (项目内 node.exe 或系统)

Step 2: 下载 NapCat.Shell.zip
  - 从 GitHub Releases 下载
  - 支持断点续传
  - 校验 SHA256（如有）

Step 3: 解压到 napcat/
  - --Force: 先清空 napcat/（rmdir /s /q）
  - 非 --Force: 增量跳过已存在文件

Step 4: 部署配置模板 [NEW]
  - 读取 config/napcat-templates/*.json
  - 复制到 napcat/napcat/config/
  - 验证 JSON 结构完整性

Step 5: 部署验证
  - 检查关键文件存在性
  - Test-OneBotConfig 验证
  - 输出部署摘要
```

### 6.2 --Force 行为对比

| 操作 | 旧逻辑 | 新逻辑 |
|------|------|------|
| 清理范围 | 仅 napcat/napcat/ + 两个文件 | 整个 napcat/ |
| 前置条件 | `if exist napcat.mjs`（有 bug） | 无条件 |
| 配置保护 | 备份→覆盖→恢复 | 不需要（模板在 git） |
| 结果 | 可能残留临时文件 | 完全干净 |

### 6.3 删除的旧逻辑

| 删除项 | 原因 |
|------|------|
| `onebot11.json` 备份/恢复 | 模板在 git，不需备份 |
| 根级 `napcat.mjs` 过滤 | --Force 清整个目录 |
| `$ProtectedFiles` 机制 | 模板不受解压覆盖 |
| `package.json` buildVersion 修补 | 只验证，不修改官方文件 |

### 6.4 模板部署伪代码

```powershell
function Deploy-NapCatConfigTemplates {
    $TemplateDir = Join-Path $RootDir 'config\napcat-templates'
    $TargetDir   = Join-Path $NapCatDir 'napcat\napcat\config'
    
    New-Item -ItemType Directory -Path $TargetDir -Force | Out-Null
    
    @('onebot11.json', 'napcat.json', 'webui.json') | ForEach-Object {
        $src = Join-Path $TemplateDir $_
        if (-not (Test-Path $src)) {
            Write-Error "模板缺失: $src"; exit 1
        }
        Copy-Item $src $TargetDir -Force
        Write-Host "  ✓ 部署: $_ → napcat/napcat/config/"
    }
    
    Test-OneBotConfig -Path (Join-Path $TargetDir 'onebot11.json')
}
```

---

## 七、后端适配

### 7.1 `qq-bot-config.json` 新增字段

```json
{
  "enabled": false,
  "napcat": {
    "path": "napcat/napcat.bat",
    "templateDir": "config/napcat-templates"
  },
  "wsPath": "/qq/ws",
  "accessToken": "",
  ...
}
```

### 7.2 spawn 逻辑

```typescript
// 旧: 硬编码路径
const napcatScript = path.join(rootDir, 'napcat/napcat.bat');

// 新: 从配置读取，启动前检查
const config = loadQQBotConfig();
const napcatScript = path.join(rootDir, config.napcat.path);

if (!existsSync(napcatScript)) {
  throw new Error(
    'NapCat 未安装。请运行: scripts\\setup.bat'
  );
}

const napcatDir = path.dirname(napcatScript);
spawn(napcatScript, [], {
  cwd: napcatDir,
  stdio: ['ignore', 'pipe', 'pipe']
});
```

### 7.3 不再需要的逻辑

| 移除 | 原因 |
|------|------|
| `strip-bom.js` 在启动流程中的调用 | 模板是干净 UTF-8 without BOM |
| 硬编码 `napcat/napcat.bat` | 改为从 config 读取 |

---

## 八、启动/停止流程

### 8.1 首次部署流程

```
git clone → cd projectEL → npm install
  → .\scripts\setup.bat          （下载 NapCat、解压、复制模板）
  → npm run dev                  （启动前后端）
  → WebUI 点击"启动 QQ Bot"     （后端 spawn napcat.bat）
```

### 8.2 日常启动

```
npm run dev
  → WebUI 点击"启动 QQ Bot"
  → 后端检查 napcat/napcat.bat 存在 → spawn → NapCat 连接 WS :3001
```

### 8.3 停止

```
WebUI 点击"停止" → POST /api/qq/stop
  → close WS server
  → taskkill /PID napcat
  → qqServiceActive = false
```

### 8.4 重新部署

```batch
scripts\setup.bat --force
:: 清空 napcat/ → 重新下载 → 重新解压 → 重新部署模板
```

---

## 九、迁移路径

从当前状态迁移到新设计的步骤：

| 步骤 | 操作 | 说明 |
|------|------|------|
| 1 | 创建 `config/napcat-templates/` | 三个 JSON 模板文件 |
| 2 | 更新 `.gitignore` | 一条 `napcat/` 替代 17 条规则 |
| 3 | 运行 `git rm -r --cached napcat/` | 停止追踪 napcat |
| 4 | 移动 `qq-bot-config.json` → `config/` | 配置文件归位 |
| 5 | 更新 `setup-napcat.ps1` | 加入模板部署逻辑 |
| 6 | 更新 `qq-adapter.ts` | 可配置 napcat 路径 |
| 7 | 更新 docs/ 文档 | 反映新结构 |
| 8 | 提交 | 干净的 git history |

---

## 十、风险与边界

| 风险 | 缓解 |
|------|------|
| 用户修改了 napcat 下的配置后 git pull 不会覆盖 | 模板只影响首次部署和 --force 重装 |
| NapCat 更新后模板字段变化 | 模板文件作为 git 追踪的源码，跟随项目更新 |
| 834 个临时目录会再次产生 | 正常现象，但在 `.gitignore` 的 `napcat/` 下，不影响 git |

### 不在此范围内的

- NapCat 进程守护/自动重启（已有独立计划）
- `qq-adapter.ts` 代码重构（已有独立计划）
- 跨平台 Linux 支持（Windows 独占现状不变）
- NapCat 版本升级机制（仍用手动 --force）
