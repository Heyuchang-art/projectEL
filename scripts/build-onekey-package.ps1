# Snapshot Pi - 绿色免安装一键包打包脚本 (Windows x64)
# 作用：自动拉取 Node.js 运行时、编译项目、整合依赖并输出可以直接双击运行的“一键包”目录。

$ErrorActionPreference = 'Stop'
$rootDir = Resolve-Path (Join-Path $PSScriptRoot '..')
$distDir = Join-Path $rootDir "dist_onekey"

Write-Host "==================================================" -ForegroundColor Cyan
Write-Host "     Snapshot Pi - 绿色一键发布包打包脚本 (Windows)   " -ForegroundColor Cyan
Write-Host "==================================================" -ForegroundColor Cyan

# 1. 创建打包输出目录
Write-Host "[1/7] 正在初始化输出目录: $distDir"
if (Test-Path $distDir) {
    Remove-Item $distDir -Recurse -Force
}
New-Item -Path $distDir -ItemType Directory | Out-Null
New-Item -Path (Join-Path $distDir "frontend") -ItemType Directory | Out-Null
New-Item -Path (Join-Path $distDir "backend") -ItemType Directory | Out-Null

# 2. 下载并集成免安装版 Node.js 运行时 (v18.16.0 x64)
Write-Host "`n[2/7] 正在集成免安装 Node.js 运行环境..."
$nodeZipUrl = "https://nodejs.org/dist/v18.16.0/node-v18.16.0-win-x64.zip"
$tempZip = Join-Path $PSScriptRoot "node-temp.zip"
$tempExtract = Join-Path $PSScriptRoot "node-temp"

if (Test-Path $tempExtract) { Remove-Item $tempExtract -Recurse -Force }

Write-Host "正在下载 Node.js 便携版..."
try {
    Invoke-WebRequest -Uri $nodeZipUrl -OutFile $tempZip -TimeoutSec 60
    Write-Host "下载成功，正在解压并创建 runtime 文件夹..."
    Expand-Archive -Path $tempZip -DestinationPath $tempExtract
    $extractedFolder = Get-ChildItem -Path $tempExtract -Directory | Select-Object -First 1
    Move-Item -Path $extractedFolder.FullName -Destination (Join-Path $distDir "runtime")
} catch {
    Write-Warning "下载 Node.js 运行时失败。打包将不包含本地 runtime 目录，解压后的机器需要预装 Node.js。"
} finally {
    if (Test-Path $tempZip) { Remove-Item $tempZip -Force }
    if (Test-Path $tempExtract) { Remove-Item $tempExtract -Recurse -Force }
}

# 3. 本地编译与构建 (Vite 前端 & TS 后端)
Write-Host "`n[3/7] 正在编译前端与后端源码..."
cd $rootDir

Write-Host "正在编译前端 (Vite React)..."
# 注意：前端静态资源将被编译到 frontend/dist 目录
cd frontend
npm install
npm run build

Write-Host "正在编译后端 (TS Express)..."
# 注意：后端源码将被编译到 backend/dist 目录
cd ../backend
npm install
npm run build
cd $rootDir

# 4. 拷贝编译成果到打包目录
Write-Host "`n[4/7] 正在拷贝编译成果与核心源文件..."

# A. 前端编译文件 (dist)
Write-Host "正在拷贝前端静态资源..."
Copy-Item -Path (Join-Path $rootDir "frontend\dist") -Destination (Join-Path $distDir "frontend\dist") -Recurse -Force

# B. 后端编译文件 (dist 与 package.json)
Write-Host "正在拷贝后端服务端代码..."
Copy-Item -Path (Join-Path $rootDir "backend\dist") -Destination (Join-Path $distDir "backend\dist") -Recurse -Force
Copy-Item -Path (Join-Path $rootDir "backend\package.json") -Destination (Join-Path $distDir "backend\package.json") -Force

# C. 拷贝 Pi SDK (因后端依赖 file: 协议本地包)
Write-Host "正在拷贝本地 Pi SDK 套件..."
New-Item -Path (Join-Path $distDir "pi-sdk") -ItemType Directory | Out-Null
Copy-Item -Path (Join-Path $rootDir "pi-sdk\packages") -Destination (Join-Path $distDir "pi-sdk\packages") -Recurse -Force
Copy-Item -Path (Join-Path $rootDir "pi-sdk\package.json") -Destination (Join-Path $distDir "pi-sdk\package.json") -Force

# D. 拷贝预设与配置文件
Write-Host "正在拷贝技能预设与基础配置..."
Copy-Item -Path (Join-Path $rootDir "skills") -Destination (Join-Path $distDir "skills") -Recurse -Force
Copy-Item -Path (Join-Path $rootDir "qq-bot-config.json") -Destination (Join-Path $distDir "qq-bot-config.json") -Force

# E. 初始化运行时目录 (.pi 缓存目录)
New-Item -Path (Join-Path $distDir ".pi") -ItemType Directory | Out-Null
New-Item -Path (Join-Path $distDir ".pi\agent") -ItemType Directory | Out-Null

# 5. 拷贝本地 NapCat 服务 (包含已同步的 DLL 和 wrapper.node)
Write-Host "`n[5/7] 正在拷贝本地 NapCat 进程组件..."
# 在拷贝前，先在本地运行一次版本适配脚本以保证 DLL 对齐
powershell -NoProfile -ExecutionPolicy Bypass -File (Join-Path $PSScriptRoot "sync-qq-shell.ps1")
Copy-Item -Path (Join-Path $rootDir "napcat") -Destination (Join-Path $distDir "napcat") -Recurse -Force

# 6. 后端依赖自动精简安装 (生产环境 node_modules)
Write-Host "`n[6/7] 正在打包精简版生产环境依赖 (排除 devDependencies)..."
cd (Join-Path $distDir "backend")

# 使用打包附带的本地 Node.js 和 npm 进行安全沙箱化安装
$localNodePath = Join-Path $distDir "runtime\node.exe"
$localNpmPath = Join-Path $distDir "runtime\npm.cmd"

if (Test-Path $localNpmPath) {
    Write-Host "使用一键包内的 Node 运行时独立部署依赖..."
    & $localNpmPath install --omit=dev --no-audit --no-fund
} else {
    Write-Host "使用系统全局 npm 部署依赖..."
    npm install --omit=dev --no-audit --no-fund
}
cd $rootDir

# 7. 生成一键启动脚本 (start.bat)
Write-Host "`n[7/7] 正在生成一键启动脚本..."
$batContent = @"
@echo off
title Snapshot Pi - AI Learning Agent 一键启动器
cls
echo ====================================================================
echo           Snapshot Pi - AI Learning Agent (绿色一键版)
echo ====================================================================
echo.

:: 1. 注入本地 Node 运行时到环境变量 PATH
if exist "%~dp0runtime" (
    set PATH=%~dp0runtime;%PATH%
    echo [运行时] 已成功加载便携版 Node 运行环境。
) else (
    echo [运行时] 警告：未在包内找到 runtime 文件夹，将使用系统全局 Node 环境。
)

:: 2. 检测端口与服务启动
echo [服务区] 正在启动后端主服务（已整合静态网页托管，端口 3000）...
start "Snapshot Pi Backend" /D "%~dp0backend" cmd /c "node dist/server.js"

:: 3. 自动调起默认浏览器访问系统
echo [界面区] 正在自动为您在浏览器中打开 Web 控制台...
timeout /t 3 >nul
start http://localhost:3000

echo.
echo ====================================================================
echo  [启动成功] 服务已在后台正常运行！
echo  - 网页控制台:    http://localhost:3000
echo  - QQ Bot WS:     ws://127.0.0.1:3001/qq/ws
echo ====================================================================
echo.
echo 如需关闭系统，请在任务栏直接关闭 "Snapshot Pi Backend" 黑色命令行窗口。
echo --------------------------------------------------------------------
pause
"@

$batPath = Join-Path $distDir "start.bat"
$batContent | Set-Content -Path $batPath -Encoding string
Write-Host "成功创建一键启动脚本: $batPath" -ForegroundColor Green

Write-Host "`n==================================================" -ForegroundColor Cyan
Write-Host " 打包完成！一键包已输出至: $distDir" -ForegroundColor Green
Write-Host " 您可将此目录压缩为 .zip 发送给其他 Windows 机器直接运行。" -ForegroundColor Green
Write-Host "==================================================" -ForegroundColor Cyan
