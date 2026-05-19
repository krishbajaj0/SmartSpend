# Gmail SMTP Setup for OTP Emails

## Why This is Needed
The app sends OTP codes via email during registration and login. Without proper SMTP credentials, OTPs are only logged to the console (dev mode).

## Steps to Enable Real Email Delivery

### 1. Enable 2-Factor Authentication (2FA)
- Go to https://myaccount.google.com/security
- Scroll to "Signing in to Google"
- Enable **2-Step Verification** if not already enabled

### 2. Generate an App Password
- Go to https://myaccount.google.com/apppasswords
- At "Select app", choose **Mail**
- At "Select device", choose **Other (Custom name)** → type `SmartSpend Backend`
- Click **Generate**
- You'll see a 16-character password like: `abcd efgh ijkl mnop`
- **Copy this password** (remove spaces when adding to `.env`)

### 3. Update Backend `.env`
```bash
cd backend
# Edit .env and replace SMTP_PASS with your 16-digit app password (no spaces)
SMTP_PASS=youractualapppassword123456
```

### 4. Restart Backend
```bash
# Stop current backend (Ctrl+C in its terminal), then:
cd backend
npm start
```

### 4. Test OTP Flow
1. Open http://localhost:5173/register
2. Create a new account
3. Check your Gmail inbox for the OTP code
4. Complete verification

## Troubleshooting

| Issue | Solution |
|---|---|
| "Invalid credentials" error | Ensure SMTP_PASS has no spaces; double-check the app password |
| Email not received | Check spam folder; wait 10–30 seconds |
| Backend logs "Email sent successfully" but you didn't receive it | Verify `SMTP_USER` matches the Gmail account that generated the app password |
| Using a Google Workspace account | Admin may need to allow SMTP access |

## Dev Mode Behavior
When `SMTP_PASS` is empty or invalid:
- OTPs are **logged to console only** (with `debug.otp` in API response)
- Frontend shows a yellow "Dev Mode" box displaying the OTP
- No real emails are sent

## Changing Email Provider
Edit `backend/services/emailService.js` to use a different SMTP provider:
```javascript
transporter = nodemailer.createTransport({
    host: 'smtp.your-provider.com',
    port: 587,
    secure: false, // true for 465
    auth: { user, pass }
});
```
