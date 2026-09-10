@echo off
title OES - Overtime and Expense Management System
color 0B

echo ===================================================================
echo     OES - Overtime and Expense Management System Launcher
echo ===================================================================
echo.

cd /d "%~dp0"

echo [1/4] Checking supporting services (Docker)...
docker info >nul 2>&1
if %ERRORLEVEL% EQU 0 (
    echo [OK] Docker daemon is active. Starting PostgreSQL, Valkey, MinIO, and Mailpit...
    docker compose -f docker/docker-compose.yml up -d
) else (
    echo [INFO] Docker is not active. Using existing database/services...
)

echo.
echo [2/4] Verifying project dependencies...
if not exist "node_modules\" (
    echo [INFO] Installing required dependencies...
    call npm install --legacy-peer-deps
)

echo.
echo [3/4] Ensuring database schema and initial seed data are applied...
call npm run db:push >nul 2>&1
call npm run db:seed >nul 2>&1

echo.
echo [4/4] Starting server and launching browser once ready...
start /b powershell -WindowStyle Hidden -Command "$u='http://localhost:3000/login?fresh=1'; for($i=0;$i -lt 30;$i++){ try { $r=Invoke-WebRequest -Uri 'http://localhost:3000/login' -UseBasicParsing -TimeoutSec 2; if($r.StatusCode -eq 200){ break } } catch {}; Start-Sleep -Seconds 1 }; Start-Process $u"

echo.
echo ===================================================================
echo    Server URL:         http://localhost:3000
echo    Super Admin Login:  admin@oes.local / Admin@123456
echo    Mailpit Web UI:     http://localhost:8025
echo    MinIO Console:      http://localhost:9001
echo ===================================================================
echo.
echo Starting Next.js server... Press Ctrl+C anytime to stop.
echo.

npm run dev
