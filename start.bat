@echo off
title Snapshot Pi Dev Server Launcher
cls
echo ====================================================================
echo           Snapshot Pi - AI Learning Agent Launcher
echo ====================================================================
echo.
echo Scanning API keys from environment and local config...
echo.

:: ===== DeepSeek =====
if defined DEEPSEEK_API_KEY (
    echo %DEEPSEEK_API_KEY%| findstr /B "sk-ant-router" >nul 2>&1
    if errorlevel 1 (
        echo   [OK] DeepSeek       - found in system environment
        goto ds_end
    )
    echo   [skip] DeepSeek     - env var is a proxy key, checking local config
    set "DEEPSEEK_API_KEY="
)
for /f "usebackq delims=" %%k in (`node -e "try{const j=JSON.parse(require('fs').readFileSync('%~dp0.pi/auth.json','utf8'));if(j.deepseek&&j.deepseek.key)console.log(j.deepseek.key);}catch{}"`) do set "DEEPSEEK_API_KEY=%%k"
if defined DEEPSEEK_API_KEY (
    echo   [OK] DeepSeek       - found in .pi/auth.json
) else (
    echo   [--] DeepSeek       - not configured
)
:ds_end

:: ===== Anthropic =====
if defined ANTHROPIC_API_KEY (
    echo %ANTHROPIC_API_KEY%| findstr /B "sk-ant-router" >nul 2>&1
    if errorlevel 1 (
        echo   [OK] Anthropic      - found in system environment
        goto an_end
    )
    echo   [skip] Anthropic    - env var is Antigravity proxy key, not usable
    set "ANTHROPIC_API_KEY="
)
for /f "usebackq delims=" %%k in (`node -e "try{const j=JSON.parse(require('fs').readFileSync('%~dp0.pi/auth.json','utf8'));if(j.anthropic&&j.anthropic.key)console.log(j.anthropic.key);}catch{}"`) do set "ANTHROPIC_API_KEY=%%k"
if defined ANTHROPIC_API_KEY (
    echo   [OK] Anthropic      - found in .pi/auth.json
) else (
    echo   [--] Anthropic      - not configured
)
:an_end

:: ===== OpenAI =====
if defined OPENAI_API_KEY (
    echo   [OK] OpenAI         - found in system environment
    goto oa_end
)
for /f "usebackq delims=" %%k in (`node -e "try{const j=JSON.parse(require('fs').readFileSync('%~dp0.pi/auth.json','utf8'));if(j.openai&&j.openai.key)console.log(j.openai.key);}catch{}"`) do set "OPENAI_API_KEY=%%k"
if defined OPENAI_API_KEY (
    echo   [OK] OpenAI         - found in .pi/auth.json
) else (
    echo   [--] OpenAI         - not configured
)
:oa_end


:: ===== Qwen (Alibaba DashScope) =====
if defined DASHSCOPE_API_KEY (
    echo   [OK] Qwen/DashScope  - found in system environment
    goto qw_end
)
for /f "usebackq delims=" %%k in (`node -e "try{const j=JSON.parse(require('fs').readFileSync('%~dp0.pi/auth.json','utf8'));if(j.qwen&&j.qwen.key)console.log(j.qwen.key);}catch{}"`) do set "DASHSCOPE_API_KEY=%%k"
if defined DASHSCOPE_API_KEY (
    echo   [OK] Qwen/DashScope  - found in .pi/auth.json
) else (
    echo   [--] Qwen/DashScope  - not configured
)
:qw_end

:: ===== OpenRouter =====
if defined OPENROUTER_API_KEY (
    echo   [OK] OpenRouter      - found in system environment
    goto or_end
)
for /f "usebackq delims=" %%k in (`node -e "try{const j=JSON.parse(require('fs').readFileSync('%~dp0.pi/auth.json','utf8'));if(j.openrouter&&j.openrouter.key)console.log(j.openrouter.key);}catch{}"`) do set "OPENROUTER_API_KEY=%%k"
if defined OPENROUTER_API_KEY (
    echo   [OK] OpenRouter      - found in .pi/auth.json
) else (
    echo   [--] OpenRouter      - not configured
)
:or_end

echo.
echo --------------------------------------------------------------------
echo  Tip: Configure missing keys via the Settings panel (gear icon)
echo  or set env vars: DEEPSEEK_API_KEY, DASHSCOPE_API_KEY, etc.
echo --------------------------------------------------------------------

:: ===== Check and Download NapCat Binaries =====
if not exist "%~dp0napcat\node.exe" (
    echo.
    echo --------------------------------------------------------------------
    echo  [WARNING] NapCat binaries are missing.
    echo  Downloading and installing NapCat Shell ^(v4.18.4^) automatically...
    echo --------------------------------------------------------------------
    powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\install-napcat.ps1"
)

:: ===== Dependency Pre-check & Auto-Install =====
echo.
echo Checking project dependencies...

where node >nul 2>&1
if errorlevel 1 (
    echo --------------------------------------------------------------------
    echo  [ERROR] Node.js is not installed or not in your PATH.
    echo  Please install Node.js v18+ to run this project.
    echo --------------------------------------------------------------------
    pause
    exit /b 1
)

node "%~dp0scripts\check-deps.js"
if errorlevel 1 (
    echo.
    echo --------------------------------------------------------------------
    echo  [WARNING] Missing dependencies detected!
    echo  Running 'npm install' automatically to install them...
    echo --------------------------------------------------------------------
    echo.
    cd /d "%~dp0"
    call npm install
    if errorlevel 1 (
        echo.
        echo --------------------------------------------------------------------
        echo  [ERROR] 'npm install' failed. Please run it manually to check.
        echo --------------------------------------------------------------------
        pause
        exit /b 1
    )
    echo.
    echo Re-checking dependencies...
    node "%~dp0scripts\check-deps.js"
    if errorlevel 1 (
        echo --------------------------------------------------------------------
        echo  [ERROR] Dependency check still failed after running npm install.
        echo --------------------------------------------------------------------
        pause
        exit /b 1
    )
) else (
    echo   [OK] All workspace dependencies are installed.
)

echo.
echo Starting Backend Express Server (Port 3000)...
start "Snapshot Pi Backend" /D "%~dp0backend" cmd /k "title Snapshot Pi Backend Server && npx tsx src/server.ts"

echo Starting Frontend Vite Server (Port 5173)...
start "Snapshot Pi Frontend" /D "%~dp0frontend" cmd /k "title Snapshot Pi Frontend Page && npm run dev"

echo.
echo ====================================================================
echo  [SUCCESS] All services launched!
echo  - Frontend Web UI:   http://localhost:5173
echo  - Backend API:       http://localhost:3000
echo  - QQ WS (NapCat):    ws://127.0.0.1:3001/qq/ws
echo ====================================================================
pause
