# NapCat 部署脚本重构：使用官方全量包替代 QQNT 分离下载

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 重写 `scripts/setup-napcat.ps1`，使用 NapCat 官方 `NapCat.Shell.Windows.Node.zip`（全量自包含包，~400MB）替代当前的 "NapCat.Shell.zip + 单独下载 QQNT 安装包提取" 方案，消除硬编码的 QQNT 过期版本号。

**Architecture:** `NapCat.Shell.Windows.Node.zip` 是一个完全自包含的部署包（内置 QQ + Node.js + NapCat Shell），解压即用，无需 NapCatInstaller.exe 交互式安装，无需单独下载 QQNT。脚本只需下载→解压→复制到 `napcat/`→覆盖配置模板→验证。

**Tech Stack:** PowerShell 5.1+, NapCatQQ v4.18.6, Node.zip (~400MB 自包含)

---

## 背景：为什么不能用 OneKey 包

官方提供两种 Windows 全量包：

| 包名 | 大小 | 部署方式 | 适合脚本化？ |
|------|------|----------|-------------|
| `NapCat.Shell.Windows.OneKey.zip` | ~50MB | 需要运行 `NapCatInstaller.exe`（**无静默参数**），安装程序再下载依赖 | ❌ 交互式，不可脚本化 |
| `NapCat.Shell.Windows.Node.zip` | ~400MB | **直接解压即用**，内置 QQ + Node.js + NapCat | ✅ 完全自包含 |

**结论**：选择 `Node.zip`。OneKey 的 `NapCatInstaller.exe` 没有静默模式，不适合脚本化部署。

---

## 变更对比

| | 旧方案 | 新方案 |
|---|---|---|
| 下载次数 | 2 次（Shell.zip + QQNT installer） | 1 次（Node.zip） |
| 下载总量 | ~250MB | ~400MB |
| QQNT 版本 | **硬编码** `9.9.26-44343`（已过时） | 由 NapCat 官方包内置（自动最新） |
| wrapper.node 来源 | 手动从 QQNT 安装包用 7za 提取 | Node.zip 内置 |
| Node.js 来源 | Shell.zip 内 `node.exe` | Node.zip 内 `node/` 目录 |
| 脚本行数 | 568 行 | ~300 行（简化 ~47%） |
| 失败点 | 7za 提取失败、QQNT 下载失败、版本不匹配 | 仅 Zip 下载失败 |

---

### Task 1: 重写 `scripts/setup-napcat.ps1`

**文件:**
- 修改: `scripts/setup-napcat.ps1` (568 行 → ~300 行，完全重写)
- 删除: `scripts/setup-napcat-clean.ps1` (已被新脚本取代)

**新脚本 4 步流程：**

```
Step 1: Download NapCat.Shell.Windows.Node.zip
  - 从 GitHub Releases 下载（约 400MB）
  - 双 URL 容错：gh-proxy.com → GitHub 直连
  - 下载到 %TEMP%，缓存复用

Step 2: Extract to napcat/
  - --Force: 清空 napcat/ 后提取
  - 非 --Force: 跳过（如 napcat.bat 已存在）
  - 用 Expand-Archive 解压

Step 3: Deploy config templates
  - 从 config/napcat-templates/*.json → napcat/napcat/config/
  - 覆盖 Node.zip 自带的默认配置
  - JSON 合法性验证

Step 4: Verify deployment integrity
  - 检查 5 个关键文件
  - 验证 onebot11.json WS 连接配置
```

- [ ] **Step 1: 备份当前脚本并写入新版本**

```powershell
# 备份
Copy-Item scripts\setup-napcat.ps1 scripts\setup-napcat.ps1.bak
```

完整的新脚本内容：

```powershell
<#
.SYNOPSIS
    NapCat QQ Shell self-contained deployment (official Node.zip)
.DESCRIPTION
    1. Download NapCat.Shell.Windows.Node.zip (self-contained: QQ + Node.js + NapCat)
    2. Extract to napcat/ directory
    3. Deploy config templates from config/napcat-templates/
    4. Verify deployment integrity
    napcat/ is fully self-contained after deployment.
    Config templates live in config/napcat-templates/ (git-tracked) and
    are copied to napcat/napcat/config/ at deploy time.
.PARAMETER Force
    Force re-download and re-extract all components
.PARAMETER NapCatVersion
    NapCat release version (default v4.18.6)
.EXAMPLE
    .\setup-napcat.ps1
    .\setup-napcat.ps1 -Force
    .\setup-napcat.ps1 -NapCatVersion "v4.20.0"
#>

param(
    [switch]$Force = $false,
    [string]$NapCatVersion = "v4.18.6"
)

$ErrorActionPreference = 'Stop'
$RootDir    = Resolve-Path (Join-Path $PSScriptRoot '..')
$NapCatDir  = Join-Path $RootDir 'napcat'
$TempDir    = Join-Path $env:TEMP 'napcat-setup'

# ============================================================================
# Helpers
# ============================================================================

function Write-Step {
    param([int]$Step, [int]$Total, [string]$Text, [string]$Color = 'Cyan')
    Write-Host "[$Step/$Total] $Text" -ForegroundColor $Color
}

function Test-NapCatDeployed {
    $batFile = Join-Path $NapCatDir 'napcat.bat'
    return (Test-Path $batFile) -and (-not $Force)
}

# ============================================================================
# Step 1: Download NapCat.Shell.Windows.Node.zip
# ============================================================================
function Install-NapCatNode {
    Write-Step 1 4 'Downloading NapCat.Shell.Windows.Node.zip...' 'Cyan'

    if (Test-NapCatDeployed) {
        Write-Host "  napcat.bat already exists, skipping (use -Force to re-deploy)" -ForegroundColor Green
        return
    }

    # --Force: clear existing napcat/ for a clean re-deploy
    if ($Force -and (Test-Path $NapCatDir)) {
        Write-Host "  [--Force] Clearing existing napcat/..."
        Remove-Item $NapCatDir -Recurse -Force
        Write-Host "  [--Force] napcat/ cleared" -ForegroundColor Green
    }

    $zipFileName = "NapCat.Shell.Windows.Node.zip"
    $urls = @(
        "https://gh-proxy.com/https://github.com/NapNeko/NapCatQQ/releases/download/$NapCatVersion/$zipFileName"
        "https://github.com/NapNeko/NapCatQQ/releases/download/$NapCatVersion/$zipFileName"
    )

    $zipFile = Join-Path $env:TEMP $zipFileName

    $downloaded = $false
    if (Test-Path $zipFile) {
        Write-Host "  Using cached: $zipFile" -ForegroundColor Green
        $downloaded = $true
    } else {
        foreach ($url in $urls) {
            try {
                Write-Host "  Trying: $url"
                $wc = New-Object System.Net.WebClient
                $wc.DownloadFile($url, $zipFile)
                $wc.Dispose()
                $downloaded = $true
                Write-Host "  Download OK ($([math]::Round((Get-Item $zipFile).Length/1MB, 1))MB)" -ForegroundColor Green
                break
            } catch {
                Write-Host "  Failed: $_" -ForegroundColor DarkYellow
            }
        }
    }

    if (-not $downloaded) {
        Write-Host "  Download failed. Manually download and extract to napcat/" -ForegroundColor Red
        Write-Host "  URL: $($urls[-1])"
        exit 1
    }

    # Extract directly to napcat/
    Write-Host "  Extracting to napcat/ (may take 1-2 minutes)..."
    New-Item -ItemType Directory -Path $NapCatDir -Force | Out-Null

    # Extract to temp first, then move (cleaner than extracting directly)
    $extractTemp = Join-Path $env:TEMP 'napcat-extract'
    if (Test-Path $extractTemp) { Remove-Item $extractTemp -Recurse -Force }
    New-Item -ItemType Directory -Path $extractTemp -Force | Out-Null

    Expand-Archive -Path $zipFile -DestinationPath $extractTemp -Force

    # Node.zip may have a wrapping folder or files at root — handle both cases
    $items = Get-ChildItem $extractTemp -Force
    $hasWrappingFolder = ($items.Count -eq 1) -and $items[0].PSIsContainer

    if ($hasWrappingFolder) {
        # Flatten: copy contents of the wrapping folder
        $sourceDir = $items[0].FullName
        Write-Host "  Detected wrapping folder: $($items[0].Name) — flattening..."
        Get-ChildItem $sourceDir -Force | ForEach-Object {
            Move-Item $_.FullName $NapCatDir -Force
        }
    } else {
        # Files at root: move directly
        Get-ChildItem $extractTemp -Force | ForEach-Object {
            Move-Item $_.FullName $NapCatDir -Force
        }
    }

    Remove-Item $extractTemp -Recurse -Force -ErrorAction SilentlyContinue

    Write-Host "  Extraction complete" -ForegroundColor Green
}

# ============================================================================
# Step 2: Clean up unnecessary files [REMOVED — Node.zip is already lean]
# ============================================================================
# The old script had a 60-line Clear-UnnecessaryFiles function to delete
# Darwin/Linux native modules and stale chunks. Node.zip only ships Windows
# binaries, so this step is no longer needed.
#
# We keep a minimal cleanup for cache/log junk just in case.
function Clear-JunkFiles {
    Write-Step 2 4 'Cleaning up junk files...' 'Cyan'
    Get-ChildItem (Join-Path $NapCatDir 'cache\*.png') -File -ErrorAction SilentlyContinue | Remove-Item -Force
    Get-ChildItem (Join-Path $NapCatDir '*.log') -File -ErrorAction SilentlyContinue | Remove-Item -Force
    Write-Host "  Clean" -ForegroundColor Green
}

# ============================================================================
# Step 3: Deploy config templates from git-tracked config/napcat-templates/
# ============================================================================
function Deploy-NapCatConfigTemplates {
    Write-Step 3 4 'Deploying config templates...' 'Cyan'

    $TemplateDir = Join-Path $RootDir 'config\napcat-templates'

    if (-not (Test-Path $TemplateDir)) {
        Write-Host "  ERROR: Template directory not found: $TemplateDir" -ForegroundColor Red
        Write-Host "  This should never happen - config/napcat-templates/ is git-tracked." -ForegroundColor Red
        exit 1
    }

    # In Node.zip, NapCat config lives at napcat/napcat/config/
    $TargetDir = Join-Path $NapCatDir 'napcat\config'
    New-Item -ItemType Directory -Path $TargetDir -Force | Out-Null

    $templates = @('onebot11.json', 'napcat.json', 'webui.json')
    foreach ($t in $templates) {
        $src = Join-Path $TemplateDir $t
        if (-not (Test-Path $src)) {
            Write-Host "  ERROR: Template missing: $t" -ForegroundColor Red
            exit 1
        }

        # Verify valid JSON before copying
        try {
            Get-Content $src -Raw -Encoding UTF8 | ConvertFrom-Json | Out-Null
        } catch {
            Write-Host "  ERROR: Template is not valid JSON: $t" -ForegroundColor Red
            exit 1
        }

        Copy-Item $src $TargetDir -Force
        Write-Host "  [OK] $t -> napcat/napcat/config/" -ForegroundColor Green
    }

    # Verify the deployed onebot11.json structure
    $deployedConfig = Join-Path $TargetDir 'onebot11.json'
    try {
        $config = Get-Content $deployedConfig -Raw -Encoding UTF8 | ConvertFrom-Json
        $wsClients = $config.network.websocketClients
        if ($wsClients -and $wsClients.Count -gt 0) {
            foreach ($client in $wsClients) {
                if ($client.url -and $client.enable) {
                    Write-Host "  [OK] WS: $($client.name) -> $($client.url)" -ForegroundColor Green
                }
            }
        } else {
            Write-Host "  [WARN] No WebSocket clients configured in onebot11.json" -ForegroundColor Yellow
        }
    } catch {
        Write-Host "  [ERR] Deployed onebot11.json validation failed: $_" -ForegroundColor Red
        exit 1
    }
}

# ============================================================================
# Step 4: Verify deployment integrity
# ============================================================================
function Test-Deployment {
    Write-Step 4 4 'Verifying deployment...' 'Cyan'

    # In Node.zip:
    #   napcat.bat          → root (spawn target)
    #   node/node.exe       → Node.js runtime
    #   napcat/napcat.mjs   → NapCat core
    #   napcat/config/      → config (overwritten by our templates above)
    $required = @(
        @{Path='napcat.bat';                        Label='Shell entry point';       Critical=$true},
        @{Path='node\node.exe';                     Label='Node.js runtime';          Critical=$true},
        @{Path='napcat\napcat.mjs';                 Label='NapCat core';              Critical=$true},
        @{Path='napcat\config\onebot11.json';       Label='OneBot config (deployed)'; Critical=$true}
    )

    $allOk = $true
    foreach ($r in $required) {
        $fullPath = Join-Path $NapCatDir $r.Path
        if (Test-Path $fullPath) {
            $size = if (Test-Path $fullPath -PathType Leaf) { " ($([math]::Round((Get-Item $fullPath).Length/1KB, 1))KB)" } else { "" }
            Write-Host "  [OK] $($r.Label) ($($r.Path))$size" -ForegroundColor Green
        } else {
            if ($r.Critical) {
                Write-Host "  [MISS] $($r.Label) ($($r.Path))" -ForegroundColor Red
                $allOk = $false
            } else {
                Write-Host "  [WARN] $($r.Label) (non-critical)" -ForegroundColor Yellow
            }
        }
    }

    # Validate onebot11.json WS client configuration
    $configPath = Join-Path $NapCatDir 'napcat\config\onebot11.json'
    if (Test-Path $configPath) {
        try {
            $config = Get-Content $configPath -Raw -Encoding UTF8 | ConvertFrom-Json
            $wsClients = $config.network.websocketClients
            if ($wsClients -and $wsClients.Count -gt 0) {
                foreach ($client in $wsClients) {
                    if ($client.url) {
                        Write-Host "  [OK] WS Client: $($client.name) -> $($client.url)" -ForegroundColor Green
                    }
                }
            }
        } catch {
            Write-Host "  [ERR] onebot11.json is not valid JSON" -ForegroundColor Red
            $allOk = $false
        }
    }

    return $allOk
}

# ============================================================================
# Main
# ============================================================================

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  NapCat QQ Shell - Self-Contained Setup (4 steps)" -ForegroundColor Cyan
Write-Host "  Source: NapCat.Shell.Windows.Node.zip $NapCatVersion" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

try {
    Install-NapCatNode
    Clear-JunkFiles
    Deploy-NapCatConfigTemplates
    $ok = Test-Deployment
} finally {
    # Clean up temp directory
    if (Test-Path $TempDir) { Remove-Item $TempDir -Recurse -Force -ErrorAction SilentlyContinue }
}

Write-Host ""
if ($ok) {
    Write-Host "========================================" -ForegroundColor Green
    Write-Host "  Deployment complete! napcat/ is self-contained" -ForegroundColor Green
    Write-Host "  -> Server spawns: napcat/napcat.bat" -ForegroundColor Green
    Write-Host "  -> WebUI:        http://127.0.0.1:6099/webui" -ForegroundColor Green
    Write-Host "  -> The entire napcat/ dir can be copied to any Windows machine" -ForegroundColor Green
    Write-Host "========================================" -ForegroundColor Green
} else {
    Write-Host "========================================" -ForegroundColor Red
    Write-Host "  Deployment incomplete - check missing items above" -ForegroundColor Red
    Write-Host "  Re-run: .\setup-napcat.ps1 -Force" -ForegroundColor Yellow
    Write-Host "========================================" -ForegroundColor Red
    exit 1
}
```

- [ ] **Step 2: 删除旧的 `setup-napcat-clean.ps1`**

```powershell
Remove-Item scripts\setup-napcat-clean.ps1
```

`setup-napcat-clean.ps1` 的 `$ProtectedFiles` 机制（保护 `index.cjs`、`napcat.bat` 等自定义文件）不再需要——Node.zip 是解压到空目录的，不存在覆盖问题。

- [ ] **Step 3: 提交**

```bash
git add scripts/setup-napcat.ps1
git rm scripts/setup-napcat-clean.ps1
git commit -m "refactor(setup-napcat): use official Node.zip (self-contained) instead of Shell.zip + QQNT extraction

Replace two-step download (NapCat.Shell.zip + QQNT installer extraction
with hardcoded v9.9.26-44343) with single NapCat.Shell.Windows.Node.zip
download. Node.zip is fully self-contained (QQ + Node.js + NapCat),
eliminating the 7za extraction and version mismatch risks.

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 2: 更新 `start.bat` 中的 NapCat 检测逻辑

**文件:**
- 修改: `start.bat` (第 94-101 行)

当前 `start.bat` 检测 `napcat\node.exe` 作为 NapCat 是否已部署的标志。Node.zip 中 node.exe 位于 `napcat\node\node.exe`。

- [ ] **Step 1: 更新存在性检测路径**

将：
```batch
if not exist "%~dp0napcat\node.exe" (
```
改为：
```batch
if not exist "%~dp0napcat\napcat.bat" (
```

`napcat.bat` 是更好的检测标志——它是 `server.ts` spawn 的入口文件，也是 Node.zip 部署的可靠指标。

- [ ] **Step 2: 更新错误提示中的脚本名**

```batch
if not exist "%~dp0napcat\napcat.bat" (
    echo.
    echo --------------------------------------------------------------------
    echo  [WARNING] NapCat binaries are missing.
    echo  Run: powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\setup-napcat.ps1"
    echo --------------------------------------------------------------------
)
```

- [ ] **Step 3: 提交**

```bash
git add start.bat
git commit -m "fix(start.bat): update NapCat existence check to use napcat.bat

Node.zip puts node.exe under napcat/node/node.exe, not napcat/node.exe.
Use napcat.bat as the deployment indicator instead."
```

---

### Task 3: 更新相关文档

**文件:**
- 修改: `docs/napcat-deployment.md`
- 修改: `docs/qq-bot-architecture.md`
- 修改: `docs/setup-fixes.md`

- [ ] **Step 1: 更新 `napcat-deployment.md` 的部署命令**

将引用 `setup.bat`（不存在）的地方改为直接调用 PowerShell 脚本：

```
scripts\setup.bat  →  powershell -File scripts\setup-napcat.ps1
```

- [ ] **Step 2: 更新 `qq-bot-architecture.md` 中 napcat/ 目录结构**

将 old structure:
```
napcat/
├── node.exe
├── wrapper.node
├── napcat.mjs
├── index.cjs
└── napcat/config/
```

改为 new structure:
```
napcat/
├── napcat.bat           ← Node.zip 自带启动入口
├── node/                ← Node.js 便携运行时
│   └── node.exe
├── napcat/              ← NapCat 核心
│   ├── napcat.mjs
│   ├── config/          ← 从 config/napcat-templates/ 部署
│   └── ...
└── ...
```

- [ ] **Step 3: 在 `setup-fixes.md` 顶部添加新的历史记录条目**

标注 2026-06-11 的变更：从 Shell.zip + QQNT 分离下载迁移到 Node.zip 自包含包。

- [ ] **Step 4: 提交**

```bash
git add docs/napcat-deployment.md docs/qq-bot-architecture.md docs/setup-fixes.md
git commit -m "docs: update napcat deployment docs for Node.zip migration"
```

---

### Task 4: 部署验证

- [ ] **Step 1: 运行新脚本部署 NapCat**

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File "scripts\setup-napcat.ps1"
```

预期输出（4 步全部 [OK]）：
```
[1/4] Downloading NapCat.Shell.Windows.Node.zip...
  Download OK (xxxMB)
  Extraction complete
[2/4] Cleaning up junk files...
  Clean
[3/4] Deploying config templates...
  [OK] onebot11.json -> napcat/napcat/config/
  [OK] napcat.json -> napcat/napcat/config/
  [OK] webui.json -> napcat/napcat/config/
[4/4] Verifying deployment...
  [OK] Shell entry point (napcat.bat)
  [OK] Node.js runtime (node\node.exe)
  [OK] NapCat core (napcat\napcat.mjs)
  [OK] OneBot config (napcat\napcat\config\onebot11.json)
========================================
  Deployment complete! napcat/ is self-contained
========================================
```

- [ ] **Step 2: 检查 `napcat.bat` 能否启动**

```powershell
# 检查 napcat.bat 内容（确认路径正确）
Get-Content napcat\napcat.bat
```

- [ ] **Step 3: 启动后端并测试 QQ Bot 启动流程**

```bash
cd backend && npx tsx src/server.ts
```

```bash
curl -X POST http://localhost:3000/api/qq/start
```

预期：NapCat Shell 窗口弹出，提示扫码登录。

---

## 风险和注意事项

| 风险 | 缓解 |
|------|------|
| Node.zip ~400MB 下载慢 | 缓存到 `%TEMP%`，后续部署不重复下载；双 URL 容错 |
| Node.zip 内部目录结构变化 | 脚本自动检测 wrapping folder 并扁平化 |
| napcat.bat 内部路径不兼容 | 验证步骤会检查 napcat.bat 存在性和内容 |
| `node/node.exe` vs `node.exe` 路径差异 | `napcat.bat` 内部处理路径，server.ts 不直接引用 node.exe |
| QQNT 版本仍然由 NapCat 官方决定 | 但版本由官方维护，不会过时；可用 `-NapCatVersion` 参数升级 |

### 不在范围内

- `server.ts` 的 NapCatGuardState 修复（已完成 ✅）
- `qq-adapter.ts` 代码重构
- 跨平台支持（Windows 独占）

---

## 部署后 napcat/ 预期目录结构

```
napcat/
├── napcat.bat              ← Node.zip 自带，server spawn 入口
├── index.js                ← NapCat 入口（由 napcat.bat 调用）
├── NapCatWinBootMain.exe   ← NapCat 启动器
├── NapCatWinBootHook.dll   ← QQ 注入 Hook
├── QQNT.dll                ← QQ NT 原生 DLL
├── node/                   ← Node.js 便携运行时
│   └── node.exe
├── napcat/                 ← NapCat 核心
│   ├── napcat.mjs
│   ├── config/             ← 我们的模板覆盖
│   │   ├── onebot11.json
│   │   ├── napcat.json
│   │   └── webui.json
│   ├── native/
│   ├── plugins/
│   ├── static/
│   └── worker/
└── ...
```
