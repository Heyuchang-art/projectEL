@echo off
title projectEL — 一键初始化部署
chcp 65001 >nul
cls

set FORCE_MODE=0
if /i "%1"=="--force" set FORCE_MODE=1

echo ====================================================================
echo           projectEL - 首次部署 / 重新初始化
echo ====================================================================
if %FORCE_MODE%==1 echo   [--force 模式 - 强制重装]
echo.

:: ===== Step 1: Node.js / npm 检查 =====
echo [1/5] 检查运行环境...
where node >nul 2>&1 || (
    echo   [FAIL] 未找到 Node.js，请先安装: https://nodejs.org/ ^(版本 ^>= 18^)
    pause
    exit /b 1
)
where npm >nul 2>&1 || (
    echo   [FAIL] 未找到 npm
    pause
    exit /b 1
)
for /f "tokens=1-3 delims=." %%a in ('node -v') do set NODE_VER=%%a
echo   [OK] Node.js %NODE_VER%        (要求 ^>= 18)
echo.

:: ===== Step 2: 安装依赖 =====
echo [2/5] 安装项目依赖 (npm install)...
cd /d "%~dp0.."
call npm install
if errorlevel 1 (
    echo   [FAIL] npm install 失败
    pause
    exit /b 1
)
echo   [OK] 依赖安装完成
echo.

:: ===== Step 3: 配置 API Key =====
echo [3/5] 配置 API Key...
node scripts\init-auth.js
if errorlevel 1 (
    echo   [WARN] API Key 未配置。可在启动后通过 Web 界面的 ⚙ 设置面板配置。
)
echo.

:: ===== Step 4: 部署 NapCat QQ Bot =====
echo [4/5] 部署 NapCat QQ Bot...
if %FORCE_MODE%==1 (
    powershell -NoProfile -ExecutionPolicy Bypass -File "scripts\setup-napcat.ps1" -Force
) else (
    powershell -NoProfile -ExecutionPolicy Bypass -File "scripts\setup-napcat.ps1"
)
if errorlevel 1 (
    echo   [FAIL] NapCat 部署失败
    pause
    exit /b 1
)
echo   [OK] NapCat 部署完成
echo.

:: ===== Step 5: 构建前端 =====
echo [5/5] 构建前端静态资源...
call npm run build --workspace=frontend
if errorlevel 1 (
    echo   [FAIL] 前端构建失败
    pause
    exit /b 1
)
echo   [OK] 前端构建完成 (frontend/dist/)
echo.

:: ===== 完成 =====
echo ====================================================================
echo  部署完成！
echo.
echo  启动方式:  双击 start.bat
echo  访问地址:  http://localhost:3000
echo.
echo  NapCat WebUI:  http://127.0.0.1:6099/webui
echo.
echo  如需重新部署全部组件:  scripts\setup.bat --force
echo ====================================================================
echo.
pause
