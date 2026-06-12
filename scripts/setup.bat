@echo off
title projectEL Setup
cls

set FORCE_MODE=0
if /i "%1"=="--force" set FORCE_MODE=1

echo ====================================================================
echo           projectEL - First-time Setup / Re-initialize
echo ====================================================================
if %FORCE_MODE%==1 echo   [--force mode - will reinstall everything]
echo.

:: ===== Step 1: Check Node.js / npm =====
echo [1/5] Checking environment...
where node >nul 2>&1 || (
    echo   [FAIL] Node.js not found. Install from: https://nodejs.org/ v18+
    pause
    exit /b 1
)
where npm >nul 2>&1 || (
    echo   [FAIL] npm not found
    pause
    exit /b 1
)
for /f "tokens=1-3 delims=." %%a in ('node -v') do set NODE_VER=%%a
echo   [OK] Node.js %NODE_VER% (requires v18+)
echo.

:: ===== Step 2: Install dependencies =====
echo [2/5] Installing dependencies (npm install)...
cd /d "%~dp0.."
call npm install
if errorlevel 1 (
    echo   [FAIL] npm install failed
    pause
    exit /b 1
)
echo   [OK] Dependencies installed
echo.

:: ===== Step 3: Configure API keys =====
echo [3/5] Configuring API keys...
node scripts\init-auth.js
if errorlevel 1 (
    echo   [WARN] No API key configured. You can configure via Web UI later.
)
echo.

:: ===== Step 4: Deploy NapCat QQ Bot =====
echo [4/5] Deploying NapCat QQ Bot...
if %FORCE_MODE%==1 (
    powershell -NoProfile -ExecutionPolicy Bypass -File "scripts\setup-napcat.ps1" -Force
) else (
    powershell -NoProfile -ExecutionPolicy Bypass -File "scripts\setup-napcat.ps1"
)
if errorlevel 1 (
    echo   [FAIL] NapCat deployment failed
    pause
    exit /b 1
)
echo   [OK] NapCat deployed
echo.

:: ===== Step 5: Build frontend =====
echo [5/5] Building frontend static assets...
call npm run build --workspace=frontend
if errorlevel 1 (
    echo   [FAIL] Frontend build failed
    pause
    exit /b 1
)
echo   [OK] Frontend built (frontend/dist/)
echo.

:: ===== Done =====
echo ====================================================================
echo  Setup complete!
echo.
echo  To start:  double-click start.bat
echo  Web UI:    http://localhost:3000
echo.
echo  NapCat WebUI:  http://127.0.0.1:6099/webui
echo.
echo  To reinstall everything:  scripts\setup.bat --force
echo ====================================================================
echo.
pause
