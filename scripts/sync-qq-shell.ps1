# Snapshot Pi - QQNT & NapCat 版本自动适配脚本
# 作用：自动检测系统安装的 QQNT 版本，复制所需 wrapper.node 和 DLL，并同步修改 JSON 配置文件。

$ErrorActionPreference = 'Stop'
$destDir = Resolve-Path (Join-Path $PSScriptRoot '..\napcat')

Write-Host "==================================================" -ForegroundColor Cyan
Write-Host "  Snapshot Pi - NapCat QQNT 自动版本适配与迁移脚本   " -ForegroundColor Cyan
Write-Host "==================================================" -ForegroundColor Cyan

# 1. 从注册表检测 QQNT 安装路径与版本
Write-Host "[1/4] 正在检测本地系统安装的 QQNT..."
$qqRegPath = "HKLM:\SOFTWARE\WOW6432Node\Microsoft\Windows\CurrentVersion\Uninstall\QQ"
if (-not (Test-Path $qqRegPath)) {
    Write-Error "在系统中未找到 QQNT 注册表信息，请确认是否已安装官方 QQNT 客户端。"
}

$qqInfo = Get-ItemProperty -Path $qqRegPath -ErrorAction SilentlyContinue
$displayVersion = $qqInfo.DisplayVersion
$uninstallString = $qqInfo.UninstallString

if (-not $displayVersion) {
    Write-Error "未能从注册表中读取到 QQNT 的版本号。"
}

# 提取主安装目录
# 卸载程序一般在: C:\Program Files\Tencent\QQNT\Uninstall.exe
$installDir = Split-Path (Split-Path $uninstallString.Replace('"', ''))
Write-Host "检测到官方 QQNT 目录: $installDir" -ForegroundColor Green
Write-Host "检测到系统 QQNT 版本: $displayVersion" -ForegroundColor Green

# 2. 检查 NapCat 的版本限制说明
# NapCat 官方限制：建议使用 QQNT 9.9.15 或更高版本
Write-Host "`n[2/4] 正在检查 NapCat 与 QQNT 版本兼容性..."
$verParts = $displayVersion -split '\.'
if ($verParts.Length -ge 3) {
    $major = [int]$verParts[0]
    $minor = [int]$verParts[1]
    $patch = [int]$verParts[2]
    
    # 限制1：低于 9.9.15 无法运行
    if ($major -lt 9 -or ($major -eq 9 -and $minor -lt 9) -or ($major -eq 9 -and $minor -eq 9 -and $patch -lt 15)) {
        Write-Warning "【警告】检测到系统 QQNT 版本低于 9.9.15，NapCat 可能无法正常运行，强烈建议升级您的 QQ 客户端！"
    } else {
        Write-Host "版本兼容性检查通过 (版本 >= 9.9.15)" -ForegroundColor Green
    }
    
    # 提示：如果版本非常新（例如高于 9.9.30），可能需要更新 NapCat 核心
    if ($major -eq 9 -and $minor -eq 9 -and $patch -gt 30) {
        Write-Host "【提示】您安装的 QQNT 版本较新 ($displayVersion)，如果运行中出现闪退或消息接收失败，请确保运行了最新的 NapCat 版本 (在 scripts 目录下运行 install-napcat.ps1)。" -ForegroundColor Yellow
    }
}

# 3. 寻找匹配版本的资源路径
$versionsDir = Join-Path $installDir "versions"
if (-not (Test-Path $versionsDir)) {
    Write-Error "未能在 QQ 目录中找到 versions 文件夹，请确认是否为新版 QQNT。"
}

# versions 目录下可能有名为 9.9.26-44343 的文件夹
$versionFolder = Get-ChildItem -Path $versionsDir -Directory | Where-Object { $_.Name -like "*$patch*" -or $_.Name -match "^\d+\.\d+\.\d+-\d+$" } | Select-Object -First 1
if (-not $versionFolder) {
    # 降级：直接取最新修改的文件夹
    $versionFolder = Get-ChildItem -Path $versionsDir -Directory | Sort-Object LastWriteTime -Descending | Select-Object -First 1
}

if (-not $versionFolder) {
    Write-Error "未能在 versions 目录下找到匹配的版本资源文件夹。"
}

$srcDir = Join-Path $versionFolder.FullName "resources\app"
Write-Host "找到 QQNT 核心资源目录: $srcDir" -ForegroundColor Green

# 4. 复制 wrapper.node 和 DLL 文件
Write-Host "`n[3/4] 正在复制核心二进制及 DLL 依赖文件..."
$filesToCopy = @(
    "wrapper.node",
    "QBar.dll",
    "LightQuic.dll",
    "avif_convert.dll",
    "broadcast_ipc.dll",
    "libglib-2.0-0.dll",
    "libgobject-2.0-0.dll",
    "libvips-42.dll",
    "ncnn.dll",
    "opencv.dll"
)

# 复制 resources/app 下的文件
foreach ($file in $filesToCopy) {
    $srcPath = Join-Path $srcDir $file
    $destPath = Join-Path $destDir $file
    if (Test-Path $srcPath) {
        Copy-Item -Path $srcPath -Destination $destPath -Force
        Write-Host "成功同步: $file"
    } else {
        Write-Warning "未在 resources/app 下找到 $file，跳过"
    }
}

# 复制特殊的 QQNT.dll (在 versions 根目录，不在 resources/app 内部)
$dllSrc = Join-Path $versionFolder.FullName "QQNT.dll"
$dllDest = Join-Path $destDir "QQNT.dll"
if (Test-Path $dllSrc) {
    Copy-Item -Path $dllSrc -Destination $dllDest -Force
    Write-Host "成功同步: QQNT.dll"
} else {
    Write-Warning "未找到 QQNT.dll，可能需要通过 QQ 启动环境确认。"
}

# 5. 更新本地 JSON 配置文件版本号
Write-Host "`n[4/4] 正在更新本地 NapCat 配置文件版本号..."
$targetVersion = $versionFolder.Name # 例如 "9.9.26-44343"
$buildId = $targetVersion -split '-' | Select-Object -Last 1

# A. package.json
$pkgPath = Join-Path $destDir "package.json"
if (Test-Path $pkgPath) {
    $pkg = Get-Content -Path $pkgPath -Raw | ConvertFrom-Json
    $pkg.version = $targetVersion
    $pkg.buildVersion = $buildId
    $pkg | ConvertTo-Json -Depth 10 | Set-Content -Path $pkgPath -Encoding utf8
    Write-Host "已同步更新 napcat/package.json" -ForegroundColor Green
}

# B. config.json
$cfgPath = Join-Path $destDir "config.json"
if (Test-Path $cfgPath) {
    $cfg = Get-Content -Path $cfgPath -Raw | ConvertFrom-Json
    $cfg.baseVersion = $targetVersion
    $cfg.curVersion = $targetVersion
    $cfg.buildId = $buildId
    $cfg | ConvertTo-Json -Depth 10 | Set-Content -Path $cfgPath -Encoding utf8
    Write-Host "已同步更新 napcat/config.json" -ForegroundColor Green
}

# C. napcat/qqnt.json
$qqntPath = Join-Path $destDir "napcat\qqnt.json"
if (Test-Path $qqntPath) {
    $qqnt = Get-Content -Path $qqntPath -Raw | ConvertFrom-Json
    $qqnt.version = $targetVersion
    $qqnt.buildVersion = $buildId
    $qqnt | ConvertTo-Json -Depth 10 | Set-Content -Path $qqntPath -Encoding utf8
    Write-Host "已同步更新 napcat/napcat/qqnt.json" -ForegroundColor Green
}

Write-Host "`n==================================================" -ForegroundColor Cyan
Write-Host "  版本适配完成！当前 NapCat 已完美绑定至 $targetVersion" -ForegroundColor Green
Write-Host "==================================================" -ForegroundColor Cyan
