Write-Host "🔍 SmartSpend Setup Verification" -ForegroundColor Cyan
Write-Host "================================" -ForegroundColor Gray

# 1. Node.js
Write-Host "`n1️⃣ Node.js:" -ForegroundColor Yellow
node --version 2>$null | ForEach-Object { Write-Host "   ✅ $_" -ForegroundColor Green }

# 2. MongoDB check
Write-Host "`n2️⃣ MongoDB:" -ForegroundColor Yellow
$mongoResult = mongosh --eval "db.runCommand({ping:1})" 2>&1
if ($LASTEXITCODE -eq 0) {
    Write-Host "   ✅ MongoDB connected" -ForegroundColor Green
} else {
    Write-Host "   ⚠️ MongoDB not running" -ForegroundColor Yellow
}

# 3. .env check
Write-Host "`n3️⃣ Backend .env:" -ForegroundColor Yellow
if (Test-Path "backend\.env") {
    $envContent = Get-Content "backend\.env" -Raw
    if ($envContent -match "MONGO_URI=" -and $envContent -match "JWT_SECRET=") {
        Write-Host "   ✅ Core vars present" -ForegroundColor Green
    }
    if ($envContent -match "SMTP_USER=") {
        Write-Host "   ✅ SMTP_USER set" -ForegroundColor Green
    }
    if ($envContent -match "SMTP_PASS=") {
        $passVal = ($envContent -split "`n" | Where-Object { $_ -like "SMTP_PASS=*" }) -replace "SMTP_PASS=", ""
        if ($passVal.Trim()) {
            Write-Host "   ✅ SMTP_PASS configured — real emails will be sent" -ForegroundColor Green
        } else {
            Write-Host "   ℹ️  SMTP_PASS empty → Dev mode (OTP on screen only)" -ForegroundColor Cyan
        }
    }
} else {
    Write-Host "   ❌ backend/.env not found" -ForegroundColor Red
}

# 4. Server status
Write-Host "`n4️⃣ Server status:" -ForegroundColor Yellow
try {
    $resp = Invoke-WebRequest "http://localhost:5000/api/health" -UseBasicParsing -TimeoutSec 2
    if ($resp.StatusCode -eq 200) { Write-Host "   ✅ Backend: http://localhost:5000" -ForegroundColor Green }
} catch { Write-Host "   ⚠️  Backend not running (cd backend && npm start)" -ForegroundColor Yellow }

try {
    $resp = Invoke-WebRequest "http://localhost:5173" -UseBasicParsing -TimeoutSec 2
    if ($resp.StatusCode -eq 200) { Write-Host "   ✅ Frontend: http://localhost:5173" -ForegroundColor Green }
} catch { Write-Host "   ⚠️  Frontend not running (cd frontend && npm run dev)" -ForegroundColor Yellow }

Write-Host "`n✅ Check complete!" -ForegroundColor Green
Write-Host "`n📖 To configure Gmail SMTP, see: OTP_SETUP.md" -ForegroundColor Cyan
