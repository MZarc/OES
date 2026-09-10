@echo off
title OES - Production Server
color 0A

echo ===================================================================
echo     OES - Production Server Launcher
echo ===================================================================
echo.

cd /d "%~dp0"

echo [1/3] Checking supporting services (Docker)...
docker info >nul 2>&1
if %ERRORLEVEL% EQU 0 (
    echo [OK] Docker daemon is active. Starting containers...
    docker compose -f docker/docker-compose.yml up -d
)

echo.
echo [2/3] Building production bundle if needed...
if not exist ".next\BUILD_ID" (
    echo [INFO] No production build found or dev cache detected.
    echo [INFO] Compiling fresh production build...
    call npm run build
)

echo.
echo [3/3] Launching OES Production Server and opening browser once ready...
start /b powershell -WindowStyle Hidden -Command "$u='http://localhost:3000/login?fresh=1'; for($i=0;$i -lt 30;$i++){ try { $r=Invoke-WebRequest -Uri 'http://localhost:3000/login' -UseBasicParsing -TimeoutSec 2; if($r.StatusCode -eq 200){ break } } catch {}; Start-Sleep -Seconds 1 }; Start-Process $u"

echo.
echo ===================================================================
echo    Server URL: http://localhost:3000
echo ===================================================================
echo.

npm run start
