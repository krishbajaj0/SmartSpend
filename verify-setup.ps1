Write-Host "🔍 SmartSpend Setup Verification" -ForegroundColor Cyan
Write-Host "================================" -ForegroundColor Gray

# 1. Node.js
Write-Host ""
Write-Host "[1] Node.js:" -ForegroundColor Yellow
node --version 2>$null | ForEach-Object { Write-Host "   [OK] $_" -ForegroundColor Green }

# 2. MongoDB check
Write-Host ""
Write-Host "[2] MongoDB:" -ForegroundColor Yellow
$tcpClient = New-Object System.Net.Sockets.TcpClient
$connect = $tcpClient.BeginConnect("127.0.0.1", 27017, $null, $null)
$wait = $connect.AsyncWaitHandle.WaitOne(800, $false)
if ($wait -and $tcpClient.Connected) {
    Write-Host "   [OK] MongoDB is running on port 27017" -ForegroundColor Green
    $tcpClient.Close()
} else {
    Write-Host "   [WARN] MongoDB not running or not listening on port 27017" -ForegroundColor Yellow
}

# 3. env check
Write-Host ""
Write-Host "[3] Backend env:" -ForegroundColor Yellow
if (Test-Path "backend\.env") {
    $envContent = Get-Content "backend\.env" -Raw
    if ($envContent -match "MONGO_URI=" -and $envContent -match "JWT_SECRET=") {
        Write-Host "   [OK] Core vars present" -ForegroundColor Green
    }
    if ($envContent -match "SMTP_USER=") {
        Write-Host "   [OK] SMTP_USER set" -ForegroundColor Green
    }
    if ($envContent -match "SMTP_PASS=") {
        $passLine = $envContent -split "`r?`n" | Where-Object { $_ -like "SMTP_PASS=*" }
        $passVal = $passLine -replace "^SMTP_PASS=", ""
        if ($passVal -and $passVal.Trim()) {
            Write-Host "   [OK] SMTP_PASS configured - real emails will be sent" -ForegroundColor Green
        } else {
            Write-Host "   [INFO] SMTP_PASS empty - Dev mode (OTP on screen only)" -ForegroundColor Cyan
        }
    }
} else {
    Write-Host "   [ERROR] backend\.env not found" -ForegroundColor Red
}

# 4. Server status
Write-Host ""
Write-Host "[4] Server status:" -ForegroundColor Yellow
try {
    $resp = Invoke-WebRequest "http://localhost:5000/api/health" -UseBasicParsing -TimeoutSec 2
    if ($resp.StatusCode -eq 200) {
        Write-Host "   [OK] Backend: http://localhost:5000" -ForegroundColor Green
    }
} catch {
    Write-Host "   [WARN] Backend not running (start with npm start in backend)" -ForegroundColor Yellow
}

try {
    $resp = Invoke-WebRequest "http://localhost:5173" -UseBasicParsing -TimeoutSec 2
    if ($resp.StatusCode -eq 200) {
        Write-Host "   [OK] Frontend: http://localhost:5173" -ForegroundColor Green
    }
} catch {
    Write-Host "   [WARN] Frontend not running (start with npm run dev in frontend)" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "[OK] Check complete!" -ForegroundColor Green
Write-Host "[INFO] To configure Gmail SMTP, see: OTP_SETUP.md" -ForegroundColor Cyan
