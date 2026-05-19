# SmartSpend — Complete Setup Guide

## 🚀 Quick Start

### Prerequisites
- **Node.js** ≥ 18.x
- **MongoDB** running locally on `mongodb://127.0.0.1:27017`
- **Gmail account** (for OTP emails) — optional, dev mode works without it

---

## 1. Install Dependencies

```bash
# Backend
cd backend
npm install

# Frontend (in another terminal)
cd frontend
npm install
```

## 2. Configure Environment

### Backend `.env`
```bash
cd backend
cp .env .env.local  # backup
# Edit .env and set:
# - MONGO_URI (default is fine for local)
# - SMTP_PASS = your Gmail App Password (see next section)
```

### Gmail SMTP Setup (for real OTP emails)

1. **Enable 2-Factor Authentication**
   - Visit https://myaccount.google.com/security
   - Enable "2-Step Verification"

2. **Generate App Password**
   - Visit https://myaccount.google.com/apppasswords
   - App: `Mail` | Device: `Other (Custom name)` → `SmartSpend Backend`
   - Copy the 16-digit password (e.g., `abcd efgh ijkl mnop`)
   - **Remove spaces** and paste into `backend/.env`:
     ```
     SMTP_PASS=abcdefghijklmnop
     ```

3. **Verify SMTP User**
   - `SMTP_USER` is already set to `smartspend7@gmail.com`
   - This must match the Gmail account that generated the App Password

> **Note**: If you want to use a different Gmail address, update both `SMTP_USER` and generate the App Password from that account.

## 3. Start Servers

Open **two** terminals:

**Terminal 1 — Backend**:
```bash
cd backend
npm start
```
Expected output:
```
🔌 Socket.io initialized
✅ MongoDB connected: 127.0.0.1
🚀 Server running on port 5000
📧 SMTP User: smartspend7@gmail.com
📅 Cron jobs initialized
```

**Terminal 2 — Frontend**:
```bash
cd frontend
npm run dev
```
Open http://localhost:5173 in your browser.

---

## 4. Verify OTP is Working

### In Dev Mode (SMTP_PASS empty)
- Register a new account → OTP appears **on screen** in a yellow box
- Check backend console: OTP also logged there
- No real email sent

### With SMTP Configured
- Register → check your Gmail inbox for the 6-digit code
- OTP expires in **10 minutes**
- 5 attempts max before requiring a resend

---

## 5. API Diagnostics

### Health Check
```bash
curl http://localhost:5000/api/health
# {"success":true,"message":"SmartExpense API is running",...}
```

### SMTP Status (dev only)
```bash
curl http://localhost:5000/api/debug/smtp
# {"configured":false,"message":"SMTP not configured — OTPs will only appear in console"}
# or
# {"configured":true,"message":"SMTP is configured"}
```

---

## 📁 Project Structure

```
Smart Spend/
├── backend/
│   ├── controllers/    # Route handlers
│   ├── models/         # Mongoose schemas
│   ├── routes/         # Express routers
│   ├── services/       # AI, email, analytics, notifications
│   ├── middleware/     # Auth, error handling, validation
│   └── .env            # ← Add SMTP_PASS here
├── frontend/
│   ├── src/
│   │   ├── components/ # Reusable UI
│   │   ├── pages/      # Route pages
│   │   ├── context/    # Auth, Theme, Toast
│   │   └── utils/      # API client, currency, mock data
│   └── .env            # Optional: VITE_API_URL
└── docker-compose.yml  # Optional: full stack
```

---

## 🔧 Common Issues

| Problem | Fix |
|---|---|
| `MongoDB connection error` | Ensure `mongod` is running (`net start MongoDB` or `brew services start mongodb-community`) |
| OTP not received | Check `SMTP_PASS` is set and has no spaces; verify 2FA is enabled |
| CORS errors | Backend allows `localhost:5173` by default |
| Port 5000 in use | Change `PORT` in `.env` or kill process: `lsof -ti:5000 | xargs kill -9` |
| Frontend can't connect to API | Backend must be running; check `vite.config.js` proxy |

---

## 🧹 Clean Up

### Stop all Node processes
```bash
# Windows PowerShell
taskkill /F /IM node.exe

# Or find specific
Get-Process node | Stop-Process -Force
```

### Reset database
```bash
# Connect to MongoDB
mongosh
> use smartexpense
> db.dropDatabase()
```

---

## 📚 Key Files Modified for OTP

| File | Purpose |
|---|---|
| `backend/controllers/authController.js` | Returns `debug.otp` when SMTP is off |
| `backend/services/emailService.js` | Mock mode detection |
| `frontend/src/pages/LoginPage.jsx` | Shows debug OTP box |
| `frontend/src/pages/RegisterPage.jsx` | Same |
| `frontend/src/pages/ForgotPasswordPage.jsx` | Same |
| `frontend/src/components/auth/OTPVerification.jsx` | Accepts & displays `debugOtp` prop |

---

## 🎯 Next Steps (Optional)

- [ ] Add real MongoDB Atlas connection string in `MONGO_URI`
- [ ] Deploy backend to Railway/Render (set env vars there)
- [ ] Deploy frontend to Vercel/Netlify
- [ ] Configure production email (SendGrid, Mailgun, or Gmail with App Password)

---

## Need Help?
- Backend logs: check the terminal where `npm start` is running
- Frontend logs: browser DevTools → Console
- Network tab: verify requests to `http://localhost:5000/api/*`
