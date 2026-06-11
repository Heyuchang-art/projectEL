<#
.SYNOPSIS
    NapCat QQ Shell 一键自包含部署

.DESCRIPTION
    1. 下载 NapCat.Shell.zip（如尚未安装）
    2. 从本机 QQNT 提取 wrapper.node + 全部 DLL 依赖
    3. 更新版本配置文件
    4. 验证部署完整性
    5. 部署完成后 napcat/ 目录完全自包含，可整体迁移到任意 Windows 机器

.PARAMETER QQNTPath
    手动指定 QQNT 安装目录（可选，默认自动探测）

.PARAMETER NapCatVersion
    NapCat 版本号（默认 v4.18.4）

.PARAMETER SkipDownload
    跳过 NapCat Shell 下载（如已手动安装）

.EXAMPLE
    .\setup-napcat.ps1
    .\setup-napcat.ps1 -QQNTPath "D:\QQNT"
    .\setup-napcat.ps1 -SkipDownload -NapCatVersion "v4.20.0"
#>

param(
    [string]$QQNTPath = "",
    [string]$NapCatVersion = "v4.18.4",
    [switch]$SkipDownload = $false
)

$ErrorActionPreference = 'Stop'
$RootDir    = Resolve-Path (Join-Path $PSScriptRoot '..')
$NapCatDir  = Join-Path $RootDir 'napcat'
$TempDir    = Join-Path $env:TEMP 'napcat-shell-setup'
$ZipFile    = Join-Path $env:TEMP 'NapCat.Shell.zip'

# ═══════════════════════════════════════════════════════════════════════════
# 受保护文件列表（git 跟踪的自定义版本，不可被 NapCat 官方包覆盖）
# ═══════════════════════════════════════════════════════════════════════════
$ProtectedFiles = @(
    'index.cjs',
    'napcat.bat',
    'launcher.bat',
    'launcher-user.bat'
)

# ═══════════════════════════════════════════════════════════════════════════
# Step 1: 探测 QQNT 安装目录
# ═══════════════════════════════════════════════════════════════════════════
function Find-QQNTInstallation {
    # 用户手动指定
    if ($QQNTPath -and (Test-Path (Join-Path $QQNTPath 'versions'))) {
        Write-Host "[1/6] QQNT 安装目录（手动指定）: $QQNTPath" -ForegroundColor Green
        return $QQNTPath
    }

    # a) 注册表
    try {
        $reg = Get-ItemProperty 'HKLM:\SOFTWARE\WOW6432Node\Microsoft\Windows\CurrentVersion\Uninstall\QQ' -ErrorAction SilentlyContinue
        if ($reg.UninstallString) {
            $dir = Split-Path ($reg.UninstallString -replace '"', '') -Parent
            if (Test-Path (Join-Path $dir 'versions')) {
                Write-Host "[1/6] QQNT 安装目录（注册表）: $dir" -ForegroundColor Green
                return $dir
            }
        }
    } catch { }

    # b) 常见路径
    $common = @(
        "$env:ProgramFiles\Tencent\QQNT",
        "${env:ProgramFiles(x86)}\Tencent\QQNT",
        "$env:LOCALAPPDATA\Programs\QQNT"
    )
    foreach ($p in $common) {
        if (Test-Path (Join-Path $p 'versions')) {
            Write-Host "[1/6] QQNT 安装目录（常见路径）: $p" -ForegroundColor Green
            return $p
        }
    }

    Write-Host "[1/6] ✗ 未找到 QQNT 安装！" -ForegroundColor Red
    Write-Host "  请安装 QQNT 桌面版: https://im.qq.com" -ForegroundColor Yellow
    Write-Host "  或手动指定: .\setup-napcat.ps1 -QQNTPath 'D:\QQNT'" -ForegroundColor Yellow
    return $null
}

# ═══════════════════════════════════════════════════════════════════════════
# Step 2: 下载 NapCat Shell（如需要）
# ═══════════════════════════════════════════════════════════════════════════
function Install-NapCatShell {
    # 如果已存在核心文件且未强制重新下载，跳过
    $coreFile = Join-Path $NapCatDir 'napcat.mjs'
    if ((Test-Path $coreFile) -and -not $SkipDownload) {
        Write-Host "[2/6] NapCat Shell 核心已存在，跳过下载" -ForegroundColor Green
        Write-Host "  如需强制重新下载，请删除 napcat/napcat.mjs 后重试" -ForegroundColor Gray
        return $true
    }

    $urls = @(
        "https://gh-proxy.com/https://github.com/NapNeko/NapCatQQ/releases/download/$NapCatVersion/NapCat.Shell.zip",
        "https://github.com/NapNeko/NapCatQQ/releases/download/$NapCatVersion/NapCat.Shell.zip"
    )

    Write-Host "[2/6] 正在下载 NapCat.Shell.zip ($NapCatVersion)..." -ForegroundColor Cyan

    $downloaded = $false
    foreach ($url in $urls) {
        try {
            Write-Host "  尝试: $url" -ForegroundColor Gray
            Invoke-WebRequest -Uri $url -OutFile $ZipFile -TimeoutSec 120
            $downloaded = $true
            Write-Host "  下载成功！" -ForegroundColor Green
            break
        } catch {
            Write-Host "  失败: $_" -ForegroundColor DarkYellow
        }
    }

    if (-not $downloaded) {
        Write-Host "[2/6] ✗ 下载失败，请检查网络连接" -ForegroundColor Red
        Write-Host "  可手动下载并解压到 napcat/ 目录后使用 -SkipDownload 参数" -ForegroundColor Yellow
        Write-Host "  下载地址: $($urls[-1])" -ForegroundColor Yellow
        return $false
    }

    # 解压到临时目录
    if (Test-Path $TempDir) { Remove-Item $TempDir -Recurse -Force }
    Write-Host "  正在解压..." -ForegroundColor Gray
    Expand-Archive -Path $ZipFile -DestinationPath $TempDir -Force
    Remove-Item $ZipFile -Force

    return $true
}

# ═══════════════════════════════════════════════════════════════════════════
# Step 3: 选择性复制（保护自定义文件）
# ═══════════════════════════════════════════════════════════════════════════
function Copy-NapCatCore {
    param([string]$SourceDir)

    Write-Host "[3/6] 正在安装 NapCat Shell 核心文件..." -ForegroundColor Cyan

    # 确保目标目录存在（napcat/ 不再预创建，由 zip 内 napcat/ 扁平合并到根）
    $subdirs = @('native', 'plugins', 'static', 'worker', 'config', 'node_modules', 'win64')
    foreach ($sd in $subdirs) {
        $destSub = Join-Path $NapCatDir $sd
        if (-not (Test-Path $destSub)) {
            New-Item -ItemType Directory -Path $destSub -Force | Out-Null
        }
    }

    # 复制所有文件，但跳过受保护文件
    $allItems = Get-ChildItem $SourceDir -Force
    foreach ($item in $allItems) {
        $destPath = Join-Path $NapCatDir $item.Name

        # 跳过受保护文件
        if ($ProtectedFiles -contains $item.Name) {
            Write-Host "  跳过（受保护）: $($item.Name)" -ForegroundColor DarkGray
            continue
        }

        # 跳过注入模式专属文件 + zip 根级 napcat.mjs（正确的在 napcat/ 子目录中）
        if ($item.Name -match '^(NapCatWinBootMain\.exe|NapCatWinBootHook\.dll|loadNapCat\.js|launcher-win10.*\.bat|quickLoginExample\.bat|napcat\.mjs)$') {
            Write-Host "  跳过（注入模式）: $($item.Name)" -ForegroundColor DarkGray
            continue
        }

        if ($item.PSIsContainer) {
            # napcat/ 目录：扁平化——内容直接合并到 NapCatDir 根目录
            if ($item.Name -eq 'napcat') {
                Copy-Item "$($item.FullName)\*" $NapCatDir -Recurse -Force
                Write-Host "  ✓ napcat/ → 扁平化到根目录" -ForegroundColor Green
                continue
            }
            # 其他目录：合并复制到同名子目录
            if (Test-Path $destPath) {
                Copy-Item "$($item.FullName)\*" $destPath -Recurse -Force
            } else {
                Copy-Item $item.FullName $destPath -Recurse -Force
            }
            Write-Host "  ✓ $($item.Name)/" -ForegroundColor Green
        } else {
            Copy-Item $item.FullName $destPath -Force
            Write-Host "  ✓ $($item.Name)" -ForegroundColor Green
        }
    }

    # 清理临时目录
    if (Test-Path $TempDir) {
        Remove-Item $TempDir -Recurse -Force
    }
}

# ═══════════════════════════════════════════════════════════════════════════
# Step 4: 从 QQNT 提取二进制文件
# ═══════════════════════════════════════════════════════════════════════════
function Sync-QQNTBinaries {
    param([string]$QQNTRoot)

    Write-Host "[4/6] 正在从 QQNT 提取 wrapper.node 及 DLL 依赖..." -ForegroundColor Cyan

    # 匹配版本目录
    $versionsDir = Join-Path $QQNTRoot 'versions'
    $candidates = Get-ChildItem $versionsDir -Directory |
        Where-Object { $_.Name -match '^\d+\.\d+\.\d+-\d+$' } |
        Sort-Object Name -Descending

    if (-not $candidates) {
        Write-Host "  ✗ versions 目录下无匹配的版本文件夹" -ForegroundColor Red
        return $null
    }

    # 优先精确匹配 config.json 中的版本
    $cfgPath = Join-Path $NapCatDir 'config.json'
    $targetVersion = ''
    if (Test-Path $cfgPath) {
        try {
            $cfg = Get-Content $cfgPath -Raw | ConvertFrom-Json
            $targetVersion = $cfg.curVersion
            if (-not $targetVersion) { $targetVersion = $cfg.baseVersion }
        } catch { }
    }

    $selected = $null
    if ($targetVersion) {
        $exact = $candidates | Where-Object { $_.Name -eq $targetVersion } | Select-Object -First 1
        if ($exact -and (Test-Path (Join-Path $exact.FullName 'resources\app\wrapper.node'))) {
            $selected = $exact
            Write-Host "  精确匹配版本: $($selected.Name)" -ForegroundColor Green
        }
    }

    if (-not $selected) {
        foreach ($c in $candidates) {
            if (Test-Path (Join-Path $c.FullName 'resources\app\wrapper.node')) {
                $selected = $c
                Write-Host "  使用最新可用版本: $($selected.Name)" -ForegroundColor Yellow
                break
            }
        }
    }

    if (-not $selected) {
        Write-Host "  ✗ 未找到包含 wrapper.node 的版本目录" -ForegroundColor Red
        return $null
    }

    $resDir = Join-Path $selected.FullName 'resources\app'

    # 关键文件
    $criticalFiles = @('wrapper.node', 'major.node')
    foreach ($f in $criticalFiles) {
        $src = Join-Path $resDir $f
        if (Test-Path $src) {
            Copy-Item $src $NapCatDir -Force
            Write-Host "  ✓ $f (关键)" -ForegroundColor Green
        } else {
            Write-Host "  ⚠ $f 未找到" -ForegroundColor Yellow
        }
    }

    # DLL 依赖（非关键，缺失只警告）
    $dllFiles = @(
        'QBar.dll', 'LightQuic.dll', 'broadcast_ipc.dll',
        'libglib-2.0-0.dll', 'libgobject-2.0-0.dll',
        'libvips-42.dll', 'ncnn.dll', 'opencv.dll', 'avif_convert.dll'
    )
    foreach ($f in $dllFiles) {
        $src = Join-Path $resDir $f
        if (Test-Path $src) {
            Copy-Item $src $NapCatDir -Force
            Write-Host "  ✓ $f" -ForegroundColor Green
        } else {
            Write-Host "  ⚠ $f 未找到（非关键）" -ForegroundColor DarkYellow
        }
    }

    # QQNT.dll（在版本根目录，不在 resources/app 内）
    $qqntDll = Join-Path $selected.FullName 'QQNT.dll'
    if (Test-Path $qqntDll) {
        Copy-Item $qqntDll $NapCatDir -Force
        Write-Host "  ✓ QQNT.dll" -ForegroundColor Green
    } else {
        Write-Host "  ⚠ QQNT.dll 未找到（非关键）" -ForegroundColor DarkYellow
    }

    return $selected.Name
}

# ═══════════════════════════════════════════════════════════════════════════
# Step 5: 更新版本配置文件
# ═══════════════════════════════════════════════════════════════════════════
function Update-VersionConfigs {
    param([string]$Version)

    $buildId = ($Version -split '-')[-1]
    Write-Host "[5/6] 正在更新版本配置 → $Version (build $buildId)..." -ForegroundColor Cyan

    # config.json
    $cfgPath = Join-Path $NapCatDir 'config.json'
    if (Test-Path $cfgPath) {
        try {
            $c = Get-Content $cfgPath -Raw | ConvertFrom-Json
            $c.baseVersion = $Version
            $c.curVersion  = $Version
            $c.buildId     = $buildId
            $c | ConvertTo-Json -Depth 10 | Set-Content $cfgPath -Encoding utf8
            Write-Host "  ✓ config.json" -ForegroundColor Green
        } catch {
            Write-Host "  ⚠ config.json 更新失败: $_" -ForegroundColor Yellow
        }
    }

    # package.json (外层)
    $pkgPath = Join-Path $NapCatDir 'package.json'
    if (Test-Path $pkgPath) {
        try {
            $p = Get-Content $pkgPath -Raw | ConvertFrom-Json
            $p.version = $Version
            $p | Add-Member -MemberType NoteProperty -Name 'buildVersion' -Value $buildId -Force
            $p | ConvertTo-Json -Depth 10 | Set-Content $pkgPath -Encoding utf8
            Write-Host "  ✓ package.json" -ForegroundColor Green
        } catch {
            Write-Host "  ⚠ package.json 更新失败: $_" -ForegroundColor Yellow
        }
    }

    # napcat/qqnt.json (内层)
    $qqntPath = Join-Path $NapCatDir 'napcat\qqnt.json'
    if (Test-Path $qqntPath) {
        try {
            $q = Get-Content $qqntPath -Raw | ConvertFrom-Json
            $q.version = $Version
            $q | Add-Member -MemberType NoteProperty -Name 'buildVersion' -Value $buildId -Force
            $q | ConvertTo-Json -Depth 10 | Set-Content $qqntPath -Encoding utf8
            Write-Host "  ✓ napcat/qqnt.json" -ForegroundColor Green
        } catch {
            Write-Host "  ⚠ napcat/qqnt.json 更新失败: $_" -ForegroundColor Yellow
        }
    }
}

# ═══════════════════════════════════════════════════════════════════════════
# Step 6: 清理非必要组件（减小部署体积）
# ═══════════════════════════════════════════════════════════════════════════
function Clear-UnnecessaryFiles {
    Write-Host "[6/6] 正在清理非必要组件..." -ForegroundColor Cyan
    $removedSize = 0

    # ── 6a. 清理非 Windows 原生插件（darwin/linux .node 文件）─────────────
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
            Write-Host "  ✓ 移除非 Windows 插件: $($f.Name) ($([math]::Round($f.Length/1MB, 1))MB)" -ForegroundColor Gray
        }
    }

    # 清理空目录
    $platDirs = @('darwin.arm64', 'linux.arm64', 'linux.x64', 'win32-arm64')
    foreach ($platDir in $platDirs) {
        $dirs = Get-ChildItem $NapCatDir -Recurse -Directory -Filter $platDir -ErrorAction SilentlyContinue
        foreach ($d in $dirs) {
            if ($d.FullName -match '\\native\\') {
                Remove-Item $d.FullName -Recurse -Force -ErrorAction SilentlyContinue
                Write-Host "  ✓ 清理空平台目录: $($d.Name)" -ForegroundColor Gray
            }
        }
    }

    # ── 6b. 清理 WebUI 静态资源中旧 hash 的重复 chunk ─────────────────
    # 场景：NapCat 升级后 static/assets/ 同时存在新旧两版 chunk-XXX-YYYY.js，
    # 旧版不再被 index.html 引用，完全是死代码。
    $assetsDir = Join-Path $NapCatDir 'static\assets'
    if (Test-Path $assetsDir) {
        $indexHtml = Join-Path $NapCatDir 'static\index.html'
        if (Test-Path $indexHtml) {
            $htmlContent = Get-Content $indexHtml -Raw
            # 从 index.html 中提取所有引用的资源文件名
            $referencedFiles = [regex]::Matches($htmlContent, '(?:src|href)="[^"]*?([^/"]+)"') |
                ForEach-Object { $_.Groups[1].Value } |
                Where-Object { $_ -match '\.(js|css|png|ico|svg|woff2?)$' }
            $refSet = [System.Collections.Generic.HashSet[string]]::new()
            foreach ($rf in $referencedFiles) { [void]$refSet.Add($rf) }

            $assetFiles = Get-ChildItem $assetsDir -File
            foreach ($af in $assetFiles) {
                if (-not $refSet.Contains($af.Name)) {
                    # 只清理明显是旧版 chunk 的文件（带 hash 的 JS/CSS）
                    if ($af.Name -match '^chunk-[A-Z0-9]+-[A-Za-z0-9_-]+\.(js|css)$') {
                        $removedSize += $af.Length
                        Remove-Item $af.FullName -Force
                        Write-Host "  ✓ 移除未引用的旧 chunk: $($af.Name)" -ForegroundColor Gray
                    }
                }
            }
        }
    }

    # ── 6c. 清理部署残留 ──────────────────────────────────────────────
    $rootZip = Join-Path $RootDir 'napcat.zip'
    if (Test-Path $rootZip) {
        $zipSize = (Get-Item $rootZip).Length
        $removedSize += $zipSize
        Remove-Item $rootZip -Force
        Write-Host "  ✓ 移除部署残留: napcat.zip ($([math]::Round($zipSize/1MB, 1))MB)" -ForegroundColor Gray
    }

    $tempDir = Join-Path $env:TEMP 'napcat-shell-setup'
    if (Test-Path $tempDir) {
        Remove-Item $tempDir -Recurse -Force -ErrorAction SilentlyContinue
    }

    # ── 6d. 清理缓存/日志垃圾 ─────────────────────────────────────────
    $junkPatterns = @('cache\*.png', '*.log')
    foreach ($pattern in $junkPatterns) {
        $files = Get-ChildItem (Join-Path $NapCatDir $pattern) -File -ErrorAction SilentlyContinue
        foreach ($f in $files) {
            Remove-Item $f.FullName -Force -ErrorAction SilentlyContinue
        }
    }

    Write-Host "  总计释放: $([math]::Round($removedSize/1MB, 1))MB" -ForegroundColor Green
}

# ═══════════════════════════════════════════════════════════════════════════
# Step 7: 验证部署
# ═══════════════════════════════════════════════════════════════════════════
function Test-Deployment {
    Write-Host "`n[验证] 检查部署完整性..." -ForegroundColor Cyan

    $required = @(
        @{Path='wrapper.node';              Label='QQNT Wrapper 模块';      Critical=$true},
        @{Path='node.exe';                  Label='Node.js 运行时';         Critical=$true},
        @{Path='napcat.mjs';                Label='NapCat 核心程序';        Critical=$true},
        @{Path='config\onebot11.json';      Label='OneBot 配置';           Critical=$true},
        @{Path='index.cjs';                Label='NapCat 启动器';          Critical=$true}
    )

    $allOk = $true
    foreach ($r in $required) {
        $fullPath = Join-Path $NapCatDir $r.Path
        if (Test-Path $fullPath) {
            Write-Host "  ✓ $($r.Label) ($($r.Path))" -ForegroundColor Green
        } else {
            if ($r.Critical) {
                Write-Host "  ✗ 缺失: $($r.Label) ($($r.Path))" -ForegroundColor Red
                $allOk = $false
            } else {
                Write-Host "  ⚠ 缺失: $($r.Label) — 非关键" -ForegroundColor Yellow
            }
        }
    }

    return $allOk
}

# ═══════════════════════════════════════════════════════════════════════════
# Step 7: 验证 OneBot 配置有效性
# ═══════════════════════════════════════════════════════════════════════════
function Test-OneBotConfig {
    Write-Host "`n[验证] 检查 OneBot 配置有效性..." -ForegroundColor Cyan

    $configPath = Join-Path $NapCatDir 'config\onebot11.json'
    if (-not (Test-Path $configPath)) {
        Write-Host "  ✗ onebot11.json 不存在" -ForegroundColor Red
        return $false
    }

    try {
        $config = Get-Content $configPath -Raw -Encoding UTF8 | ConvertFrom-Json
    } catch {
        Write-Host "  ✗ onebot11.json 不是有效的 JSON: $_" -ForegroundColor Red
        return $false
    }

    # 检查 websocket 客户端配置
    $wsClients = $config.network.websocketClients
    if (-not $wsClients -or $wsClients.Count -eq 0) {
        Write-Host "  ✗ 未配置 WebSocket 客户端 (network.websocketClients)" -ForegroundColor Red
        return $false
    }

    $allOk = $true
    foreach ($client in $wsClients) {
        if (-not $client.enable) {
            Write-Host "  ⚠ WebSocket 客户端已禁用: $($client.name)" -ForegroundColor Yellow
        }
        if (-not $client.url) {
            Write-Host "  ✗ WebSocket 客户端缺少 url: $($client.name)" -ForegroundColor Red
            $allOk = $false
        } else {
            Write-Host "  ✓ WebSocket 客户端: $($client.name) -> $($client.url)" -ForegroundColor Green
        }
    }

    # 检查 token（可选但推荐）
    if (-not $config.token -or $config.token -eq '') {
        Write-Host "  ⚠ 未设置 access token（建议设置以增强安全性）" -ForegroundColor Yellow
    } else {
        Write-Host "  ✓ access token 已设置" -ForegroundColor Green
    }

    return $allOk
}

# ═══════════════════════════════════════════════════════════════════════════
# Main
# ═══════════════════════════════════════════════════════════════════════════
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  NapCat QQ Shell — 自包含部署工具" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# ── 1. 探测 QQNT ──
$qqntRoot = Find-QQNTInstallation

# ── 2. 下载 NapCat Shell ──
if (-not $SkipDownload) {
    $dlResult = Install-NapCatShell
    if (-not $dlResult) {
        Write-Host "`n[结果] ✗ 部署失败（下载环节）" -ForegroundColor Red
        exit 1
    }

    # 复制核心文件到 napcat/ 目录
    if (Test-Path $TempDir) {
        # 递归查找 napcat.mjs 定位源根目录（兼容不同版本的 zip 结构）
        $napcatMjsFile = Get-ChildItem $TempDir -Recurse -Filter 'napcat.mjs' -File | Select-Object -First 1
        if (-not $napcatMjsFile) {
            Write-Host "  ✗ 解压后的文件中未找到 napcat.mjs，zip 结构可能已变更" -ForegroundColor Red
            Write-Host "  请检查 NapCat 官方发布包结构" -ForegroundColor Yellow
            exit 1
        }
        # napcat.mjs 位于 <root>/napcat/napcat.mjs → 源根 = napcat.mjs 的祖父目录
        $extractedDir = Split-Path $napcatMjsFile.DirectoryName -Parent
        Write-Host "  检测到 NapCat 源目录: $extractedDir" -ForegroundColor Gray

        # 备份用户配置文件（Copy-NapCatCore 合并子目录时会覆盖 onebot11.json）
        $onebotBackup = $null
        $onebotConfigPath = Join-Path $NapCatDir 'config\onebot11.json'
        if (Test-Path $onebotConfigPath) {
            $onebotBackup = Get-Content $onebotConfigPath -Raw -Encoding UTF8
            Write-Host "  已备份现有 onebot11.json 配置" -ForegroundColor Gray
        }

        Copy-NapCatCore -SourceDir $extractedDir

        # 恢复用户配置文件
        if ($onebotBackup) {
            $onebotBackup | Set-Content $onebotConfigPath -Encoding UTF8 -NoNewline
            Write-Host "  ✓ 已恢复 onebot11.json 配置（保护用户设置）" -ForegroundColor Green
        }
    }
}

# ── 3. 提取 QQNT 二进制 ──
$versionUsed = $null
if ($qqntRoot) {
    $versionUsed = Sync-QQNTBinaries -QQNTRoot $qqntRoot
}

# ── 4. 更新版本配置 ──
if ($versionUsed) {
    Update-VersionConfigs -Version $versionUsed
} else {
    Write-Host "[5/6] 跳过版本配置更新（未提取 QQNT 二进制）" -ForegroundColor Yellow
}

# ── 5. 清理非必要组件 ──
Clear-UnnecessaryFiles

# ── 6. 验证 ──
$ok = Test-Deployment
$configOk = Test-OneBotConfig
if (-not $configOk) { $ok = $false }

Write-Host ""
if ($ok) {
    Write-Host "========================================" -ForegroundColor Green
    Write-Host "  ✓ 部署完成！napcat/ 目录已完全自包含" -ForegroundColor Green
    Write-Host "  → 可复制整个 napcat/ 目录到任意 Windows 机器" -ForegroundColor Green
    Write-Host "  → 使用 napcat.bat 直接启动（无需 QQNT）" -ForegroundColor Green
    Write-Host "========================================" -ForegroundColor Green
} else {
    Write-Host "========================================" -ForegroundColor Red
    Write-Host "  ✗ 部署不完整，请检查上述缺失项" -ForegroundColor Red
    if (-not $qqntRoot) {
        Write-Host "  → 需要安装 QQNT 桌面版或手动指定路径" -ForegroundColor Yellow
    }
    Write-Host "========================================" -ForegroundColor Red
    exit 1
}
