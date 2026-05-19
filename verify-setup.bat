@echo off
echo ================================
echo SmartSpend Setup Check
echo ================================
echo.

echo 1. Node.js version:
node --version
if errorlevel 1 (
    echo [ERROR] Node.js not found
    pause
    exit /b 1
)

echo.
echo 2. MongoDB connection:
mongosh --eval "db.runCommand({ping:1})" >nul 2>&1
if errorlevel 0 (
    echo [OK] MongoDB connected
) else (
    echo [WARN] MongoDB not running
)

echo.
echo 3. Backend .env:
if exist backend\.env (
    echo [OK] backend\.env exists
    findstr /C:"MONGO_URI=" backend\.env >nul && echo  [OK] MONGO_URI set
    findstr /C:"JWT_SECRET=" backend\.env >nul && echo  [OK] JWT_SECRET set
    findstr /C:"SMTP_USER=" backend\.env >nul && echo  [OK] SMTP_USER set
    findstr /C:"SMTP_PASS=" backend\.env >nul && (
        findstr /C:"SMTP_PASS=" backend\.env | findstr /V "SMTP_PASS=" >nul
        if errorlevel 1 (
            echo  [INFO] SMTP_PASS empty - Dev mode (OTP shown on screen)
        ) else (
            echo  [OK] SMTP_PASS configured - real emails will be sent
        )
    )
) else (
    echo [ERROR] backend\.env not found
)

echo.
echo 4. Server status:
curl -s http://localhost:5000/api/health >nul 2>&1
if errorlevel 0 (
    echo [OK] Backend running at http://localhost:5000
) else (
    echo [INFO] Backend not running - start with: cd backend ^&^& npm start
)

curl -s http://localhost:5173 >nul 2>&1
if errorlevel 0 (
    echo [OK] Frontend running at http://localhost:5173
) else (
    echo [INFO] Frontend not running - start with: cd frontend ^&^& npm run dev
)

echo.
echo ================================
echo Setup check complete!
echo See OTP_SETUP.md for Gmail configuration
echo ================================
pause
