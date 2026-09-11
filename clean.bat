@echo off
setlocal enabledelayedexpansion
title OES - Database Clean & Fresh Start Utility

echo.
echo ========================================================
echo   Overtime & Expense System (OES)
echo   Pristine Database Cleanup & Reset Tool
echo ========================================================
echo.
echo [WARNING] This operation will erase all test database records:
echo   - Employee Profiles & User Accounts
echo   - Submitted Overtime Records & Calculations
echo   - Expense Claims & Attachments
echo   - Audit Logs & Import Session History
echo.
echo Baseline company infrastructure (Shifts, OT Rules, 2026 Holidays,
echo Expense Categories) and Demo Sandbox (demo@oes.com) will be re-seeded.
echo.

set /p CONFIRM="Type 'YES' to confirm database reset: "
if /i not "%CONFIRM%"=="YES" (
    echo.
    echo [CANCELLED] Reset operation aborted. No changes were made.
    echo.
    pause
    exit /b 0
)

echo.
echo [1/3] Running database clean & master initialization...
call npx tsx db/fresh.ts
if %ERRORLEVEL% neq 0 (
    echo.
    echo [ERROR] Database cleanup failed! Check PostgreSQL connection string in .env
    pause
    exit /b %ERRORLEVEL%
)

echo.
echo [2/3] Seeding demo sandbox credentials (demo@oes.com / demo123456)...
call npx tsx db/seed.ts
if %ERRORLEVEL% neq 0 (
    echo.
    echo [WARNING] Database seeding returned non-zero status. Proceeding...
)

echo.
echo [3/3] Clearing local Next.js build cache...
if exist .next (
    rmdir /s /q .next
    echo   ✓ Cleared .next build cache
)

echo.
echo ========================================================
echo   ✨ CLEANUP COMPLETED SUCCESSFULLY!
echo ========================================================
echo.
echo Next Steps:
echo   1. Start app:  npm run dev  (or launch.bat)
echo   2. Access Demo: Visit http://localhost:3000/login and use demo@oes.com / demo123456
echo   3. Setup Root: Visit http://localhost:3000/setup to create Super Admin account
echo.
pause
