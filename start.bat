@echo off
title projectEL Launcher
chcp 65001 >nul
cls

echo ====================================================================
echo              projectEL - AI Learning Agent
echo ====================================================================
echo.

:: ===== 前置检查 =====
cd /d "%~dp0"

if not exist "node_modules" (
    echo  [WARN] 依赖未安装。正在运行初始化部署...
    call scripts\setup.bat
    if errorlevel 1 exit /b 1
)

if not exist "frontend\dist\index.html" (
    echo  [WARN] 前端未构建。正在构建...
    call npm run build --workspace=frontend
    if errorlevel 1 (
        echo  [FAIL] 前端构建失败
        pause
        exit /b 1
    )
    echo  [OK] 前端构建完成
)

echo  启动后端服务 (http://localhost:3000)...
echo.

:: ===== 启动后端 =====
start "projectEL Backend" /D "%~dp0backend" cmd /k "title projectEL Backend Server && npx tsx src/server.ts"

:: ===== 等待后端就绪后打开浏览器 =====
echo  等待后端就绪...
:wait_loop
timeout /t 2 /nobreak >nul
>nul 2>&1 curl -s http://localhost:3000/api/qq/status || goto wait_loop

echo  打开浏览器...
start http://localhost:3000

echo ====================================================================
echo  服务已启动！
echo  - 前端 + API:  http://localhost:3000
echo  - QQ WS:       ws://127.0.0.1:3001/qq/ws
echo ====================================================================
echo  关闭此窗口即可停止所有服务。
echo.
