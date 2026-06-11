# NapCat 部署重构 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 新仓库 clone 后 `setup-napcat.ps1` 一键部署 NapCat Shell 独立模式，无需安装 QQNT 桌面版，QQBotCard 启停正常。

**Architecture:** 最小化提取器方案：下载 QQNT NSIS 安装包 → `7za.exe` 静默解压 → 提取 `wrapper.node` + DLL → 删除临时文件。NapCat 作为 OneBot v11 WS 客户端独立运行，后端 `server.ts` 管理进程生命周期，前端 `QQBotCard.tsx` 提供启停与状态监控。

**Tech Stack:** PowerShell 5.1+, Node.js, 7-Zip standalone (7za.exe), NapCat Shell v4.18.4, QQNT NSIS installer

---

## File Map

| Action | File | Responsibility |
|:---|:---|:---|
| Create | `scripts/setup-napcat.ps1` | 最小化提取器：下载 NapCat Shell + 从 QQNT 安装包提取二进制 |
| Create | `scripts/strip-bom.js` | 清理 JSON BOM 头（NapCat 兼容性） |
| Modify | `.gitignore` | 更新 NapCat 排除规则 |
| Modify | `napcat/napcat.bat` | Shell 入口，确保引用 `index.cjs`，GBK+CRLF 编码 |
| Modify | `backend/src/server.ts:326-354` | preflight 路径对齐 + 结构化错误信息 |
| Modify | `frontend/src/components/QQBotCard.tsx:55-72` | 错误提示展示具体修复指引 |
| Track | `napcat/index.cjs` | 自定义启动器（智能三级定位 wrapper.node） |
| Track | `napcat/config.json` | QQ 版本伪装配置 |
| Track | `napcat/package.json` | QQ 伪装包信息 |
| Track | `napcat/KillQQ.bat` | 进程清理辅助 |
| Track | `napcat/config/onebot11.json` | OneBot WS 客户端配置模板 |
| Track | `napcat/config/napcat.json` | NapCat 运行时配置 |
| Track | `napcat/config/webui.json` | WebUI 配置（端口 6099） |
| Delete | `napcat/index.js` | 已被 `index.cjs` 替代 |
| Delete | `napcat/napcat/` (整个目录) | 旧嵌套结构，已扁平化 |
| Delete | `scripts/install-napcat.ps1` | 被新 `setup-napcat.ps1` 替代 |
| Delete | `scripts/sync-qq-shell.ps1` | 功能合并到 `setup-napcat.ps1` |
| Delete | `stderr.txt` `stderr2.txt` `stderr3.txt` | 调试日志残留 |
| Delete | `stdout.txt` `stdout2.txt` `stdout3.txt` | 调试日志残留 |

---

### Task 1: 更新 .gitignore 排除规则

**Files:**
- Modify: `.gitignore`

- [ ] **Step 1: 替换 NapCat 相关排除规则**

当前 `.gitignore` 第 27-68 行的 NapCat 规则替换为以下内容：

```gitignore
# NapCat: 排除大型二进制文件（通过 setup-napcat.ps1 部署）
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

# NapCat: 排除运行时生成文件
napcat/cache/
napcat/logs/
napcat/*.db*
napcat/*.log
napcat/config/napcat_*.json
napcat/config/onebot11_*.json
napcat/config/napcat_protocol_*.json

# NapCat: 排除部署残留
napcat.zip
```

> 关键变化: 
> - 移除 `napcat/napcat/napcat.mjs` → `napcat/napcat.mjs`（扁平化后路径）
> - 移除 `napcat/napcat/native/` 等深层路径，改为 `napcat/native/`
> - 移除对 `napcat/napcat/config/` 的排除，配置现在在 `napcat/config/` 且由 git 跟踪模板

- [ ] **Step 2: 验证白名单文件不会被忽略**

Run: `git check-ignore napcat/napcat.bat napcat/index.cjs napcat/config/onebot11.json`

Expected: 无输出（文件未被 ignore）

- [ ] **Step 3: Commit**

```bash
git add .gitignore
git commit -m "chore: update .gitignore for flat napcat/ structure
```

---

### Task 2: 提交 napcat/ 受保护文件到 git

**Files:**
- Track: `napcat/index.cjs`
- Track: `napcat/napcat.bat`
- Track: `napcat/config.json`
- Track: `napcat/package.json`
- Track: `napcat/KillQQ.bat`
- Track: `napcat/config/onebot11.json`
- Track: `napcat/config/napcat.json`
- Track: `napcat/config/webui.json`
- Track: `napcat/LICENSE-APACHE-2.0.txt`
- Track: `scripts/strip-bom.js`
- Track: `scripts/setup-napcat.ps1` (当前版本作为基线)
- Delete: `napcat/index.js`
- Delete: `napcat/napcat/` 下所有残留文件
- Delete: `scripts/install-napcat.ps1`
- Delete: `scripts/sync-qq-shell.ps1`
- Delete: `stderr.txt` `stderr2.txt` `stderr3.txt`
- Delete: `stdout.txt` `stdout2.txt` `stdout3.txt`

- [ ] **Step 1: 删除旧文件**

```bash
# 删除旧 index.js
git rm napcat/index.js 2>/dev/null

# 删除旧嵌套 napcat/napcat/ 目录下所有残留文件
git rm -r napcat/napcat/ 2>/dev/null || true

# 删除旧安装脚本
git rm scripts/install-napcat.ps1 scripts/sync-qq-shell.ps1 2>/dev/null || true

# 删除调试日志残留
git rm stderr.txt stderr2.txt stderr3.txt stdout.txt stdout2.txt stdout3.txt 2>/dev/null || true
```

- [ ] **Step 2: 暂存新文件**

```bash
# 暂存 napcat 受保护文件
git add napcat/napcat.bat napcat/index.cjs napcat/config.json napcat/package.json
git add napcat/KillQQ.bat napcat/LICENSE-APACHE-2.0.txt
git add napcat/config/onebot11.json napcat/config/napcat.json napcat/config/webui.json

# 暂存脚本
git add scripts/strip-bom.js scripts/setup-napcat.ps1
```

- [ ] **Step 3: 验证暂存内容**

```bash
git status
```

确认:
- `napcat/index.js` 显示为 `deleted`
- `napcat/napcat/` 下文件显示为 `deleted`
- `napcat/index.cjs` 显示为 `new file`
- `napcat/config/onebot11.json` 显示为 `new file`

- [ ] **Step 4: Commit**

```bash
git commit -m "chore: flatten napcat/ structure, track launcher files

- Replace napcat/index.js with napcat/index.cjs (smart 3-tier wrapper.node locator)
- Move config/ from napcat/napcat/config/ to napcat/config/
- Delete old injection-mode files (launchers, bootstrappers)
- Delete deprecated install-napcat.ps1 and sync-qq-shell.ps1
- Add strip-bom.js for JSON BOM cleanup
- Track setup-napcat.ps1 as baseline"
```

---

### Task 3: 重写 setup-napcat.ps1（最小化提取器）

**Files:**
- Rewrite: `scripts/setup-napcat.ps1`

这是本次重构的核心。完整重写 PowerShell 部署脚本。

- [ ] **Step 1: 写入新脚本**

```powershell
<#
.SYNOPSIS
    NapCat QQ Shell 一键自包含部署（零依赖版）
.DESCRIPTION
    1. 下载 NapCat.Shell.zip（无需 QQNT 桌面版）
    2. 从 QQNT 官方安装包静默提取 wrapper.node + DLL（不安装 QQNT）
    3. 清理非必要文件 + 验证完整性
    4. 部署完成后 napcat/ 完全自包含，可整体迁移
.PARAMETER Force
    强制重新下载和提取所有组件
.PARAMETER NapCatVersion
    NapCat Shell 版本号（默认 v4.18.4）
.EXAMPLE
    .\setup-napcat.ps1
    .\setup-napcat.ps1 -Force
    .\setup-napcat.ps1 -NapCatVersion "v4.20.0"
#>

param(
    [switch]$Force = $false,
    [string]$NapCatVersion = "v4.18.4"
)

$ErrorActionPreference = 'Stop'
$RootDir    = Resolve-Path (Join-Path $PSScriptRoot '..')
$NapCatDir  = Join-Path $RootDir 'napcat'
$TempDir    = Join-Path $env:TEMP 'napcat-setup'
$7zaExe     = Join-Path $TempDir '7za.exe'

# ═══════════════════════════════════════════════════════════════════════════
# 受保护文件列表（git 跟踪的自定义文件，不可被 NapCat 官方包覆盖）
# ═══════════════════════════════════════════════════════════════════════════
$ProtectedFiles = @(
    'napcat.bat',
    'index.cjs',
    'config.json',
    'package.json',
    'KillQQ.bat'
)

# ═══════════════════════════════════════════════════════════════════════════
# 辅助函数
# ═══════════════════════════════════════════════════════════════════════════

function Write-Step {
    param([int]$Step, [int]$Total, [string]$Text, [string]$Color = 'Cyan')
    Write-Host "[$Step/$Total] $Text" -ForegroundColor $Color
}

function Test-NapCatCoreExists {
    $coreFile = Join-Path $NapCatDir 'napcat.mjs'
    return (Test-Path $coreFile) -and (-not $Force)
}

function Test-WrapperNodeExists {
    $wrapperFile = Join-Path $NapCatDir 'wrapper.node'
    return (Test-Path $wrapperFile) -and (-not $Force)
}

function Ensure-TempDir {
    if (Test-Path $TempDir) { Remove-Item $TempDir -Recurse -Force }
    New-Item -ItemType Directory -Path $TempDir -Force | Out-Null
}

# ═══════════════════════════════════════════════════════════════════════════
# Step 1: 下载 NapCat.Shell.zip
# ═══════════════════════════════════════════════════════════════════════════
function Install-NapCatShell {
    Write-Step 1 4 '下载 NapCat Shell...' 'Cyan'

    if (Test-NapCatCoreExists) {
        Write-Host "  NapCat 核心已存在，跳过下载（使用 -Force 强制重新下载）" -ForegroundColor Green
        return
    }

    $urls = @(
        "https://gh-proxy.com/https://github.com/NapNeko/NapCatQQ/releases/download/$NapCatVersion/NapCat.Shell.zip"
        "https://github.com/NapNeko/NapCatQQ/releases/download/$NapCatVersion/NapCat.Shell.zip"
    )

    $zipFile = Join-Path $env:TEMP 'NapCat.Shell.zip'

    # 下载
    $downloaded = $false
    foreach ($url in $urls) {
        try {
            Write-Host "  尝试: $url"
            $wc = New-Object System.Net.WebClient
            $wc.DownloadFile($url, $zipFile)
            $wc.Dispose()
            $downloaded = $true
            Write-Host "  下载成功" -ForegroundColor Green
            break
        } catch {
            Write-Host "  失败: $_" -ForegroundColor DarkYellow
        }
    }

    if (-not $downloaded) {
        Write-Host "  下载失败。请手动下载并解压到 napcat/ 目录" -ForegroundColor Red
        Write-Host "  下载地址: $($urls[-1])"
        exit 1
    }

    # 解压到临时目录
    Ensure-TempDir
    Write-Host "  解压中..."
    Expand-Archive -Path $zipFile -DestinationPath $TempDir -Force
    Remove-Item $zipFile -Force

    # 找到 napcat.mjs 定位源根目录
    $napcatMjs = Get-ChildItem $TempDir -Recurse -Filter 'napcat.mjs' -File | Select-Object -First 1
    if (-not $napcatMjs) {
        Write-Host "  解压后未找到 napcat.mjs，zip 结构可能已变更" -ForegroundColor Red
        exit 1
    }

    # napcat.mjs 在 <root>/napcat/napcat.mjs → 源根是其祖父目录
    $sourceDir = Split-Path $napcatMjs.DirectoryName -Parent

    # 备份用户配置
    $onebotBackup = $null
    $onebotConfigPath = Join-Path $NapCatDir 'config\onebot11.json'
    if (Test-Path $onebotConfigPath) {
        $onebotBackup = Get-Content $onebotConfigPath -Raw -Encoding UTF8
    }

    # 复制核心文件
    Write-Host "  复制核心文件..."
    $allItems = Get-ChildItem $sourceDir -Force
    foreach ($item in $allItems) {
        $destPath = Join-Path $NapCatDir $item.Name

        # 跳过受保护文件
        if ($ProtectedFiles -contains $item.Name) {
            Write-Host "    [skip protected] $($item.Name)" -ForegroundColor DarkGray
            continue
        }

        # 跳过注入模式专属文件
        if ($item.Name -match '^(NapCatWinBootMain\.exe|NapCatWinBootHook\.dll|loadNapCat\.js|launcher-win10.*\.bat|quickLoginExample\.bat|launcher\.bat|launcher-user\.bat|conout-D9oph_Le\.js)$') {
            Write-Host "    [skip injection] $($item.Name)" -ForegroundColor DarkGray
            continue
        }

        # 跳过根级 napcat.mjs（正确的在 napcat/ 子目录中）
        if ($item.Name -eq 'napcat.mjs' -and (-not $item.PSIsContainer)) {
            Write-Host "    [skip root-level] napcat.mjs" -ForegroundColor DarkGray
            continue
        }

        if ($item.PSIsContainer) {
            if ($item.Name -eq 'napcat') {
                # napcat/ 子目录 → 扁平化到根
                Copy-Item "$($item.FullName)\*" $NapCatDir -Recurse -Force
                Write-Host "    [flat] napcat/ → root" -ForegroundColor Green
                continue
            }
            # 其他目录：合并
            if (Test-Path $destPath) {
                Copy-Item "$($item.FullName)\*" $destPath -Recurse -Force
            } else {
                Copy-Item $item.FullName $destPath -Recurse -Force
            }
            Write-Host "    [dir] $($item.Name)/" -ForegroundColor Green
        } else {
            Copy-Item $item.FullName $destPath -Force
            Write-Host "    [file] $($item.Name)" -ForegroundColor Green
        }
    }

    # 恢复用户配置
    if ($onebotBackup) {
        $onebotBackup | Set-Content $onebotConfigPath -Encoding UTF8 -NoNewline
        Write-Host "  已恢复 onebot11.json" -ForegroundColor Green
    }
}

# ═══════════════════════════════════════════════════════════════════════════
# Step 2: 最小化提取 wrapper.node + DLL（从 QQNT 安装包静默解压）
# ═══════════════════════════════════════════════════════════════════════════
function Sync-QQNTBinaries {
    Write-Step 2 4 '提取 QQNT 二进制文件...' 'Cyan'

    if (Test-WrapperNodeExists) {
        Write-Host "  wrapper.node 已存在，跳过提取（使用 -Force 强制重新提取）" -ForegroundColor Green
        return
    }

    # 2a. 从 config.json 读取期望版本
    $targetVersion = ''
    $cfgPath = Join-Path $NapCatDir 'config.json'
    if (Test-Path $cfgPath) {
        try {
            $cfg = Get-Content $cfgPath -Raw | ConvertFrom-Json
            $targetVersion = $cfg.curVersion
            if (-not $targetVersion) { $targetVersion = $cfg.baseVersion }
        } catch { }
    }
    if (-not $targetVersion) {
        $targetVersion = '9.9.26-44343'  # 已知稳定版本
    }

    Write-Host "  目标 QQNT 版本: $targetVersion"
    $buildId = ($targetVersion -split '-')[-1]

    # 2b. 下载 QQNT 安装包
    # QQNT 安装包命名: QQ9.9.26.44343_x64.exe
    $qqntVersionClean = $targetVersion -replace '-', '.'
    $qqntInstaller = "QQ${qqntVersionClean}_x64.exe"
    $qqntUrl = "https://dldir1.qq.com/qqfile/qq/QQNT/Windows/${qqntInstaller}"

    $installerPath = Join-Path $env:TEMP $qqntInstaller
    if (-not (Test-Path $installerPath)) {
        Write-Host "  下载 QQNT 安装包 (~200MB)..."
        Write-Host "  $qqntUrl"
        try {
            $wc = New-Object System.Net.WebClient
            $wc.DownloadFile($qqntUrl, $installerPath)
            $wc.Dispose()
            Write-Host "  下载成功" -ForegroundColor Green
        } catch {
            Write-Host "  下载 QQNT 安装包失败: $_" -ForegroundColor Red
            Write-Host "  手动下载 $qqntInstaller 放到 %TEMP% 后重试" -ForegroundColor Yellow
            exit 1
        }
    } else {
        Write-Host "  安装包已存在: $installerPath"
    }

    # 2c. 下载 7za.exe（如需要）
    if (-not (Test-Path $7zaExe)) {
        Write-Host "  下载 7za.exe..."
        $7zaUrl = 'https://7-zip.org/a/7za920.zip'
        $7zaZip = Join-Path $env:TEMP '7za920.zip'
        try {
            $wc = New-Object System.Net.WebClient
            $wc.DownloadFile($7zaUrl, $7zaZip)
            $wc.Dispose()
            Expand-Archive -Path $7zaZip -DestinationPath $TempDir -Force
            Remove-Item $7zaZip -Force
            Write-Host "  7za.exe 就绪" -ForegroundColor Green
        } catch {
            Write-Host "  下载 7za.exe 失败，尝试备用源..."
            $7zaUrl2 = 'https://github.com/ip7z/7zip/releases/download/24.09/7z2409-extra.7z'
            # 如果 7za 不可用，回退到 Expand-Archive 解压 NSIS（成功率低）
            Write-Host "  将尝试使用 Expand-Archive 解压 QQNT 安装包" -ForegroundColor Yellow
        }
    }

    # 2d. 解压 QQNT 安装包
    $extractDir = Join-Path $env:TEMP 'qqnt-extract'
    if (Test-Path $extractDir) { Remove-Item $extractDir -Recurse -Force }
    New-Item -ItemType Directory -Path $extractDir -Force | Out-Null

    Write-Host "  解压 QQNT 安装包（可能需要 1-2 分钟）..."

    if (Test-Path $7zaExe) {
        # 用 7za 解压 NSIS 安装包
        $extractArgs = @('x', "`"$installerPath`"", "-o`"$extractDir`"", '-y')
        $proc = Start-Process -FilePath $7zaExe -ArgumentList $extractArgs -Wait -NoNewWindow -PassThru
        if ($proc.ExitCode -ne 0) {
            Write-Host "  7za 解压失败 (exit code: $($proc.ExitCode))" -ForegroundColor Yellow
            Write-Host "  尝试用 Expand-Archive..."
            try {
                Expand-Archive -Path $installerPath -DestinationPath $extractDir -Force
            } catch {
                Write-Host "  QQNT 安装包解压完全失败" -ForegroundColor Red
                exit 1
            }
        }
    } else {
        # 回退：Expand-Archive
        try {
            Expand-Archive -Path $installerPath -DestinationPath $extractDir -Force
        } catch {
            Write-Host "  QQNT 安装包解压失败。请确保 7za.exe 可用。" -ForegroundColor Red
            exit 1
        }
    }

    # 2e. 扫描提取 wrapper.node + DLL
    Write-Host "  扫描并提取二进制文件..."

    # 在解压目录中递归搜索 wrapper.node
    $wrapperSrc = Get-ChildItem $extractDir -Recurse -Filter 'wrapper.node' -File | Select-Object -First 1
    if (-not $wrapperSrc) {
        Write-Host "  未找到 wrapper.node！QQNT 安装包结构可能已变更" -ForegroundColor Red
        Write-Host "  请报告此问题，并临时使用: 手动安装 QQNT 桌面版后重试" -ForegroundColor Yellow
        exit 1
    }

    # wrapper.node 所在目录即为 resources/app/
    $resDir = $wrapperSrc.DirectoryName
    Write-Host "  找到 wrapper.node: $resDir"

    # 提取关键文件
    $criticalFiles = @('wrapper.node', 'major.node')
    foreach ($f in $criticalFiles) {
        $src = Join-Path $resDir $f
        if (Test-Path $src) {
            Copy-Item $src $NapCatDir -Force
            Write-Host "    [critical] $f" -ForegroundColor Green
        } else {
            Write-Host "    [missing] $f" -ForegroundColor Yellow
        }
    }

    # 提取 DLL 依赖
    $dllFiles = @(
        'QBar.dll', 'LightQuic.dll', 'broadcast_ipc.dll',
        'libglib-2.0-0.dll', 'libgobject-2.0-0.dll',
        'libvips-42.dll', 'ncnn.dll', 'opencv.dll', 'avif_convert.dll'
    )
    foreach ($f in $dllFiles) {
        $src = Join-Path $resDir $f
        if (Test-Path $src) {
            Copy-Item $src $NapCatDir -Force
            Write-Host "    [dll] $f" -ForegroundColor Green
        } else {
            Write-Host "    [missing] $f (non-critical)" -ForegroundColor DarkYellow
        }
    }

    # 提取 QQNT.dll（在版本根目录，不在 resources/app 内）
    # 版本根 = resources/app 的祖父目录
    $versionRoot = Split-Path (Split-Path $resDir -Parent) -Parent
    $qqntDll = Get-ChildItem $extractDir -Recurse -Filter 'QQNT.dll' -File | Select-Object -First 1
    if ($qqntDll) {
        Copy-Item $qqntDll.FullName $NapCatDir -Force
        Write-Host "    [dll] QQNT.dll" -ForegroundColor Green
    } else {
        Write-Host "    [missing] QQNT.dll (non-critical)" -ForegroundColor DarkYellow
    }

    # 2f. 更新版本配置
    Write-Host "  更新版本配置 → $targetVersion (build $buildId)..."
    
    # config.json
    if (Test-Path $cfgPath) {
        try {
            $c = Get-Content $cfgPath -Raw | ConvertFrom-Json
            $c.baseVersion = $targetVersion
            $c.curVersion  = $targetVersion
            $c.buildId     = $buildId
            $c | ConvertTo-Json -Depth 10 | Set-Content $cfgPath -Encoding utf8
            Write-Host "    config.json ✓" -ForegroundColor Green
        } catch {
            Write-Host "    config.json 更新失败" -ForegroundColor Yellow
        }
    }

    # package.json
    $pkgPath = Join-Path $NapCatDir 'package.json'
    if (Test-Path $pkgPath) {
        try {
            $p = Get-Content $pkgPath -Raw | ConvertFrom-Json
            $p.version = $targetVersion
            $p | Add-Member -MemberType NoteProperty -Name 'buildVersion' -Value $buildId -Force
            $p | ConvertTo-Json -Depth 10 | Set-Content $pkgPath -Encoding utf8
            Write-Host "    package.json ✓" -ForegroundColor Green
        } catch {
            Write-Host "    package.json 更新失败: $_" -ForegroundColor Yellow
        }
    }

    # 2g. 清理
    Write-Host "  清理临时文件..."
    Remove-Item $extractDir -Recurse -Force -ErrorAction SilentlyContinue
    Remove-Item $installerPath -Force -ErrorAction SilentlyContinue
    Write-Host "  已清理 QQNT 安装包（释放 ~200MB）" -ForegroundColor Green
}

# ═══════════════════════════════════════════════════════════════════════════
# Step 3: 清理非必要文件
# ═══════════════════════════════════════════════════════════════════════════
function Clear-UnnecessaryFiles {
    Write-Step 3 4 '清理非必要组件...' 'Cyan'

    $removedSize = 0

    # 3a. 清理非 Windows 原生插件
    $nonWindowsPatterns = @(
        'native\**\*.darwin.*.node',
        'native\**\*.linux.*.node',
        'native\**\darwin.*\*',
        'native\**\linux.*\*'
    )
    foreach ($pattern in $nonWindowsPatterns) {
        $files = Get-ChildItem (Join-Path $NapCatDir $pattern) -File -ErrorAction SilentlyContinue
        foreach ($f in $files) {
            $removedSize += $f.Length
            Remove-Item $f.FullName -Force
            Write-Host "  - $($f.Name)" -ForegroundColor Gray
        }
    }

    # 清理非 Windows 空目录
    $platDirs = @('darwin.arm64', 'linux.arm64', 'linux.x64', 'win32-arm64')
    foreach ($platDir in $platDirs) {
        $dirs = Get-ChildItem $NapCatDir -Recurse -Directory -Filter $platDir -ErrorAction SilentlyContinue
        foreach ($d in $dirs) {
            if ($d.FullName -match '\\native\\') {
                Remove-Item $d.FullName -Recurse -Force -ErrorAction SilentlyContinue
            }
        }
    }

    # 3b. 清理 static/assets/ 中未被引用的旧 hash chunk
    $assetsDir = Join-Path $NapCatDir 'static\assets'
    if (Test-Path $assetsDir) {
        $indexHtml = Join-Path $NapCatDir 'static\index.html'
        if (Test-Path $indexHtml) {
            $htmlContent = Get-Content $indexHtml -Raw
            $referencedFiles = [regex]::Matches($htmlContent, '(?:src|href)="[^"]*?([^/"]+)"') |
                ForEach-Object { $_.Groups[1].Value } |
                Where-Object { $_ -match '\.(js|css|png|ico|svg|woff2?)$' }
            $refSet = [System.Collections.Generic.HashSet[string]]::new()
            foreach ($rf in $referencedFiles) { [void]$refSet.Add($rf) }

            $assetFiles = Get-ChildItem $assetsDir -File
            foreach ($af in $assetFiles) {
                if (-not $refSet.Contains($af.Name) -and $af.Name -match '^chunk-[A-Z0-9]+-[A-Za-z0-9_-]+\.(js|css)$') {
                    $removedSize += $af.Length
                    Remove-Item $af.FullName -Force
                }
            }
        }
    }

    # 3c. 清理缓存/日志垃圾
    Get-ChildItem (Join-Path $NapCatDir 'cache\*.png') -File -ErrorAction SilentlyContinue | Remove-Item -Force
    Get-ChildItem (Join-Path $NapCatDir '*.log') -File -ErrorAction SilentlyContinue | Remove-Item -Force

    # 3d. 清理部署残留
    $rootZip = Join-Path $RootDir 'napcat.zip'
    if (Test-Path $rootZip) { Remove-Item $rootZip -Force }

    Write-Host "  释放: $([math]::Round($removedSize/1MB, 1))MB" -ForegroundColor Green
}

# ═══════════════════════════════════════════════════════════════════════════
# Step 4: 验证部署完整性
# ═══════════════════════════════════════════════════════════════════════════
function Test-Deployment {
    Write-Step 4 4 '验证部署完整性...' 'Cyan'

    $required = @(
        @{Path='node.exe';           Label='Node.js 运行时';          Critical=$true},
        @{Path='wrapper.node';       Label='QQNT Wrapper 模块';       Critical=$true},
        @{Path='napcat.mjs';         Label='NapCat 核心程序';         Critical=$true},
        @{Path='config\onebot11.json'; Label='OneBot 配置';           Critical=$true},
        @{Path='napcat.bat';         Label='Shell 入口';             Critical=$true},
        @{Path='index.cjs';          Label='自定义启动器';            Critical=$true}
    )

    $allOk = $true
    foreach ($r in $required) {
        $fullPath = Join-Path $NapCatDir $r.Path
        if (Test-Path $fullPath) {
            Write-Host "  [OK] $($r.Label) ($($r.Path))" -ForegroundColor Green
        } else {
            if ($r.Critical) {
                Write-Host "  [MISS] $($r.Label) ($($r.Path))" -ForegroundColor Red
                $allOk = $false
            } else {
                Write-Host "  [WARN] $($r.Label) (non-critical)" -ForegroundColor Yellow
            }
        }
    }

    # 验证 onebot11.json 内容
    $configPath = Join-Path $NapCatDir 'config\onebot11.json'
    if (Test-Path $configPath) {
        try {
            $config = Get-Content $configPath -Raw -Encoding UTF8 | ConvertFrom-Json
            $wsClients = $config.network.websocketClients
            if ($wsClients -and $wsClients.Count -gt 0) {
                foreach ($client in $wsClients) {
                    if ($client.url) {
                        Write-Host "  [OK] WS Client: $($client.name) → $($client.url)" -ForegroundColor Green
                    } else {
                        Write-Host "  [WARN] WS Client missing url" -ForegroundColor Yellow
                    }
                }
            }
        } catch {
            Write-Host "  [ERR] onebot11.json 不是有效的 JSON" -ForegroundColor Red
            $allOk = $false
        }
    }

    return $allOk
}

# ═══════════════════════════════════════════════════════════════════════════
# Main
# ═══════════════════════════════════════════════════════════════════════════

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  NapCat QQ Shell — 零依赖自包含部署" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# 确保 napcat/ 目录结构存在
$subdirs = @('config', 'native', 'plugins', 'static', 'worker', 'node_modules')
foreach ($sd in $subdirs) {
    $destSub = Join-Path $NapCatDir $sd
    if (-not (Test-Path $destSub)) {
        New-Item -ItemType Directory -Path $destSub -Force | Out-Null
    }
}

try {
    Install-NapCatShell
    Sync-QQNTBinaries
    Clear-UnnecessaryFiles
    $ok = Test-Deployment
} finally {
    # 清理临时目录
    if (Test-Path $TempDir) { Remove-Item $TempDir -Recurse -Force -ErrorAction SilentlyContinue }
}

Write-Host ""
if ($ok) {
    Write-Host "========================================" -ForegroundColor Green
    Write-Host "  部署完成！napcat/ 已完全自包含" -ForegroundColor Green
    Write-Host "  → 使用 napcat.bat 直接启动" -ForegroundColor Green
    Write-Host "  → 可整体复制到任意 Windows 机器" -ForegroundColor Green
    Write-Host "========================================" -ForegroundColor Green
} else {
    Write-Host "========================================" -ForegroundColor Red
    Write-Host "  部署不完整，请检查上述缺失项" -ForegroundColor Red
    Write-Host "  重新运行: .\setup-napcat.ps1 -Force" -ForegroundColor Yellow
    Write-Host "========================================" -ForegroundColor Red
    exit 1
}
```

- [ ] **Step 2: 验证脚本语法**

Run: `powershell -NoProfile -Command "Get-Command 'scripts\setup-napcat.ps1'"` (PowerShell ISE 内语法检查)

Expected: 无语法错误

- [ ] **Step 3: Commit**

```bash
git add scripts/setup-napcat.ps1
git commit -m "feat: rewrite setup-napcat.ps1 — zero-dependency extractor

- Download NapCat Shell zip (no QQNT desktop needed)
- Extract wrapper.node + DLLs from QQNT NSIS installer via 7za.exe
- Cleanup non-Windows plugins and stale hash chunks
- Version config auto-update
- Protected file list prevents custom launcher overwrite
- Idempotent: skip steps where files already exist
- -Force flag for full re-deployment"
```

---

### Task 4: 修复 napcat.bat 编码和路径

**Files:**
- Modify: `napcat/napcat.bat`

`napcat.bat` 当前内容引用 `./index.js`，需改为 `./index.cjs`。同时需要确保 GBK+CRLF 编码。

- [ ] **Step 1: 更新 napcat.bat 内容**

```batch
@echo off
cd /d "%~dp0"
node.exe ./index.cjs %*
```

> 注意：
> - 移除 `chcp 65001`（CMD 读取阶段不可用，GBK 编码不需要）
> - `index.js` → `index.cjs`
> - 文件必须以 **GBK 编码 + CRLF 换行** 保存

- [ ] **Step 2: 验证编码**

```bash
# 检查换行符
file napcat/napcat.bat
# 检查文件大小（应与修改前一致，3 行）
wc -l napcat/napcat.bat
```

- [ ] **Step 3: Commit**

```bash
git add napcat/napcat.bat
git commit -m "fix: napcat.bat use index.cjs, remove chcp 65001"
```

---

### Task 5: 修复 server.ts preflight 路径对齐 + 结构化错误

**Files:**
- Modify: `backend/src/server.ts:326-354`

- [ ] **Step 1: 更新 preflightNapCat 函数**

Replace lines 326-354 with:

```typescript
  // ── NapCat 预检 ────────────────────────────────────────────────────
  async function preflightNapCat(): Promise<{ ok: boolean; error?: string; hint?: string }> {
    const dir = path.join(workspaceCwd, 'napcat');
    const setupCmd = 'powershell -File scripts\\setup-napcat.ps1';
    
    const checks = [
      { file: 'node.exe',           label: 'Node.js 运行时' },
      { file: 'wrapper.node',       label: 'QQNT Wrapper 原生模块' },
      { file: 'napcat.mjs',         label: 'NapCat 核心程序' },
      { file: path.join('config', 'onebot11.json'), label: 'OneBot 配置文件' },
    ];
    
    const missing: string[] = [];
    for (const c of checks) {
      if (!await fs.pathExists(path.join(dir, c.file))) {
        missing.push(`  • ${c.label} (${c.file})`);
      }
    }
    
    if (missing.length > 0) {
      return {
        ok: false,
        error: `缺少以下组件:\n${missing.join('\n')}`,
        hint: `请运行: ${setupCmd}`,
      };
    }
    
    // 清理 JSON 文件的 BOM
    const stripBom = path.join(workspaceCwd, 'scripts', 'strip-bom.js');
    if (await fs.pathExists(stripBom)) {
      try {
        const { execSync } = await import('child_process');
        execSync(`node "${stripBom}"`, { cwd: dir, timeout: 5000, windowsHide: true });
      } catch { /* strip-bom 失败不阻塞启动 */ }
    }
    return { ok: true };
  }
```

- [ ] **Step 2: 更新 /api/qq/start 处理器使用 hint**

找到 `app.post('/api/qq/start', ...)` 中调用 preflight 的地方，更新错误响应：

```typescript
      // 预检：确保 NapCat 运行环境完整
      const preflight = await preflightNapCat();
      if (!preflight.ok) {
        return res.status(400).json({ 
          success: false, 
          error: preflight.error,
          hint: preflight.hint,
        });
      }
```

- [ ] **Step 3: 编译验证**

```bash
cd backend && npx tsc --noEmit
```

Expected: 无 TypeScript 错误

- [ ] **Step 4: Commit**

```bash
git add backend/src/server.ts
git commit -m "fix: server.ts preflight paths + structured error with hint

- Use path.join for cross-platform config/onebot11.json path
- Return list of ALL missing files (not just first)
- Add hint field with one-click fix command
- Pass hint to frontend error response"
```

---

### Task 6: 修复 QQBotCard.tsx 错误展示

**Files:**
- Modify: `frontend/src/components/QQBotCard.tsx:55-72`

- [ ] **Step 1: 更新 startService 函数**

Replace `startService` (lines 55-72) with:

```tsx
  const startService = async () => {
    setActionLoading(true);
    setActionError(null);
    try {
      const res = await fetch(`${API_BASE}/start`, { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        setStatus((prev) => prev ? { ...prev, running: true } : null);
        setActionError(null);
      } else {
        // 展示具体错误 + 修复指引
        const msg = data.hint 
          ? `${data.error}\n\n修复方法: ${data.hint}`
          : (data.error || '启动失败');
        setActionError(msg);
      }
    } catch {
      setActionError('无法连接到后端服务 (localhost:3000)\n请确认后端已启动: npx tsx backend/src/server.ts');
    }
    setActionLoading(false);
    fetchData();
  };
```

- [ ] **Step 2: 编译验证**

```bash
cd frontend && npx tsc --noEmit
```

Expected: 无 TypeScript 错误

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/QQBotCard.tsx
git commit -m "fix: QQBotCard shows specific preflight errors + fix hints

- Display backend hint (one-click deploy command) when available
- Show 'check if backend is running' message on connection failure
- Preserve existing error behavior for other failure modes"
```

---

### Task 7: 端到端验证

**Files:** 无（验证 Task）

- [ ] **Step 1: 运行 setup-napcat.ps1 部署**

```bash
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/setup-napcat.ps1
```

Expected 输出:
```
[1/4] 下载 NapCat Shell...
  NapCat 核心已存在，跳过下载
[2/4] 提取 QQNT 二进制文件...
  wrapper.node 已存在，跳过提取
[3/4] 清理非必要组件...
[4/4] 验证部署完整性...
  [OK] Node.js 运行时 (node.exe)
  [OK] QQNT Wrapper 模块 (wrapper.node)
  [OK] NapCat 核心程序 (napcat.mjs)
  [OK] OneBot 配置 (config\onebot11.json)
  [OK] Shell 入口 (napcat.bat)
  [OK] 自定义启动器 (index.cjs)
  [OK] WS Client: Snapshot Pi → ws://127.0.0.1:3001/qq/ws
  部署完成！
```

- [ ] **Step 2: 验证 NapCat 进程能独立启动**

```bash
cd napcat && napcat.bat
```

Expected: NapCat 进程启动，命令行窗口显示 `[NapCat Launcher]` 日志，尝试连接 `ws://127.0.0.1:3001/qq/ws`（此时后端未开，连接失败属正常）

按 Ctrl+C 终止。

- [ ] **Step 3: 验证后端预检通过**

```bash
# 启动后端
cd backend && npx tsx src/server.ts
```

Expected: `[QQ] Config loaded (disabled, adapter not auto-started)`

```bash
# 另开终端测试 preflight（通过 start API 间接测试）
curl -X POST http://localhost:3000/api/qq/start
```

Expected (如果 NapCat 已部署):
```json
{"success":true,"message":"QQ 服务已启动"}
```

- [ ] **Step 4: 验证前端启停控件的错误处理**

打开 `http://localhost:5173`，点击 QQ Bot → 查看状态面板是否正常加载。

- [ ] **Step 5: 最终 Commit (如有修正)**

```bash
git status
# 如有遗漏，git add + git commit --amend 或新 commit
```

---

## 实现顺序

```
Task 1 (.gitignore)
  └─→ Task 2 (提交 napcat/ 受保护文件)
        └─→ Task 3 (setup-napcat.ps1 重写)
              ├─→ Task 4 (napcat.bat 修复)
              ├─→ Task 5 (server.ts 修复)
              └─→ Task 6 (QQBotCard.tsx 修复)
                    └─→ Task 7 (E2E 验证)
```

Task 3-6 可以独立并行实现（修改不同文件），Task 7 必须在所有其他 Task 完成后执行。
