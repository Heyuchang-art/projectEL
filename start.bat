@echo off
title projectEL Launcher
cls

echo ====================================================================
echo              projectEL - AI Learning Agent
echo ====================================================================
echo.

cd /d "%~dp0"

:: ---- dependency check ----
if not exist "node_modules" (
    echo  [WARN] Dependencies not installed. Running setup...
    call scripts\setup.bat
    if errorlevel 1 exit /b 1
)

if not exist "frontend\dist\index.html" (
    echo  [WARN] Frontend not built. Building...
    call npm run build --workspace=frontend
    if errorlevel 1 (
        echo  [FAIL] Frontend build failed
        pause
        exit /b 1
    )
    echo  [OK] Frontend built
)

echo  Starting backend server (http://localhost:3000)...
echo.

:: ---- launch backend ----
start "projectEL Backend" /D "%~dp0backend" cmd /k "title projectEL Backend Server && npx tsx src/server.ts"

:: ---- wait for backend, then open browser ----
echo  Waiting for backend...
:wait_loop
timeout /t 2 /nobreak >nul
>nul 2>&1 curl -s http://localhost:3000/api/qq/status || goto wait_loop

echo  Opening browser...
start http://localhost:3000

echo ====================================================================
echo  Service started!
echo  - Web UI + API:  http://localhost:3000
echo  - QQ WS:         ws://127.0.0.1:3001/qq/ws
echo ====================================================================
echo  Close this window to stop all services.
echo.
