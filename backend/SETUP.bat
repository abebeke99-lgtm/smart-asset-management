@echo off
REM Smart Asset Management - Quick Setup Script for Windows

echo.
echo ========================================
echo Smart Asset Management - MySQL Setup
echo ========================================
echo.

echo Step 1: Checking if MySQL is running...
tasklist | find /i "mysqld" > nul
if errorlevel 1 (
    echo Warning: MySQL doesn't appear to be running
    echo Please start MySQL via XAMPP or your MySQL server
    echo.
    pause
)

echo Step 2: Installing Node dependencies...
cd backend
call npm install
if errorlevel 1 (
    echo Error: Failed to install dependencies
    pause
    exit /b 1
)

echo.
echo ========================================
echo Setup Complete!
echo ========================================
echo.
echo Next steps:
echo 1. Create MySQL database (see MYSQL_SETUP.md)
echo 2. Run: npm run dev
echo 3. API will be available at http://localhost:5000
echo.
echo Default admin login:
echo Username: admin
echo Password: Admin@123
echo.
pause
