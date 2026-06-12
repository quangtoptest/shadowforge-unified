@echo off
echo ╔══════════════════════════════════════════╗
echo ║   ShadowForge Unified Server Launcher   ║
echo ╚══════════════════════════════════════════╝
echo.

cd /d "%~dp0"

if not exist "node_modules" (
    echo [1/2] Installing dependencies...
    call npm install
) else (
    echo [1/2] Dependencies already installed.
)

echo [2/2] Starting server...
echo.
npm start

pause
