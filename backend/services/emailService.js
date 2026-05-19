import nodemailer from 'nodemailer';
import constants from '../config/constants.js';
import EmailDeliveryMetric from '../models/EmailDeliveryMetric.js';

let transporter = null;

// Track recent email sends to prevent duplicate sends within 10 seconds (in-memory cache)
const recentSends = new Map();

// Provider failure circuit breaker state
let resendConsecutiveFailures = 0;
let resendCircuitOpenUntil = null;

/**
 * Check if the email send request is a duplicate (same target and purpose/subject within 10s)
 * @param {string} email 
 * @param {string} purpose 
 * @param {string} subject 
 * @returns {boolean}
 */
function isDuplicateSend(email, purpose, subject) {
    const key = purpose ? `${email}:${purpose}` : `${email}:${subject}`;
    const now = Date.now();
    const lastSend = recentSends.get(key);
    
    if (lastSend && now - lastSend < 10000) {
        return true;
    }
    recentSends.set(key, now);
    
    // Perform lazy cleanup of older entries to keep memory low
    if (recentSends.size > 200) {
        for (const [k, ts] of recentSends.entries()) {
            if (now - ts > 10000) {
                recentSends.delete(k);
            }
        }
    }
    return false;
}

/**
 * Initialize and return the Nodemailer transporter with connection pooling and keep-alive.
 */
function getTransporter() {
    if (!transporter) {
        const isGmail = constants.smtp.host === 'smtp.gmail.com' || !constants.smtp.host;
        
        console.log(`🔌 [Email Service] Initializing connection pool for SMTP: ${constants.smtp.host}`);
        
        transporter = nodemailer.createTransport({
            pool: true,
            maxConnections: 5,
            maxMessages: 100,
            rateLimit: 5,
            keepAlive: true,
            connectionTimeout: 5000,
            socketTimeout: 5000,
            ...(isGmail ? { service: 'gmail' } : {
                host: constants.smtp.host,
                port: constants.smtp.port,
                secure: constants.smtp.port === 465,
            }),
            auth: {
                user: constants.smtp.email,
                pass: constants.smtp.password,
            },
        });
    }
    return transporter;
}

/**
 * Warm up the SMTP transporter connection pool during boot to prevent cold starts on Render.
 */
export const warmupTransporter = () => {
    if (!constants.smtp.email || !constants.smtp.password) {
        console.log('⚠️ [Email Service] SMTP not configured. Warmup skipped.');
        return;
    }
    try {
        const t = getTransporter();
        if (t && typeof t.verify === 'function') {
            t.verify((error, success) => {
                if (error) {
                    console.error('⚠️ [Email Service] SMTP transporter verification failed on warmup:', error.message);
                } else {
                    console.log('🚀 [Email Service] SMTP Transporter pool warmed up and ready for real-time delivery.');
                }
            });
        }
    } catch (err) {
        console.error('⚠️ [Email Service] Exception during SMTP warmup:', err.message);
    }
};

/**
 * Helper to wrap dark branded layout around HTML content
 */
function getDarkBrandedTemplate(title, preheader, bodyContent, otpText = '', footerNote = '') {
    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
  <style>
    body {
      background-color: #0b111e;
      color: #f3f4f6;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      margin: 0;
      padding: 0;
      -webkit-font-smoothing: antialiased;
    }
    .wrapper {
      background-color: #05070c;
      padding: 40px 20px;
    }
    .container {
      background-color: #0b111e;
      color: #f3f4f6;
      border-radius: 16px;
      max-width: 500px;
      margin: 0 auto;
      border: 1px solid #1f2937;
      box-shadow: 0 10px 25px -5px rgba(0,0,0,0.3);
      overflow: hidden;
    }
    .header {
      background: linear-gradient(135deg, #1e1b4b 0%, #0f172a 100%);
      padding: 30px 20px;
      text-align: center;
      border-bottom: 1px solid #1f2937;
    }
    .brand-icon {
      font-size: 40px;
      margin-bottom: 10px;
      display: inline-block;
    }
    .brand-title {
      color: #ffffff;
      font-size: 26px;
      font-weight: 800;
      margin: 0;
      letter-spacing: -0.5px;
    }
    .brand-title span {
      background: linear-gradient(135deg, #a78bfa 0%, #6366f1 100%);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      color: #a78bfa;
    }
    .content {
      padding: 35px 25px;
      text-align: center;
    }
    .title {
      color: #ffffff;
      font-size: 20px;
      font-weight: 700;
      margin-top: 0;
      margin-bottom: 15px;
    }
    .description {
      color: #9ca3af;
      font-size: 14px;
      line-height: 1.6;
      margin-bottom: 30px;
    }
    .otp-box {
      background: linear-gradient(135deg, #1e1b4b 0%, #312e81 100%);
      border: 1px solid #4338ca;
      border-radius: 12px;
      padding: 18px;
      font-size: 38px;
      font-weight: 800;
      letter-spacing: 8px;
      color: #a78bfa;
      margin: 0 auto 30px auto;
      max-width: 280px;
      box-shadow: 0 0 15px rgba(99, 102, 241, 0.25);
    }
    .expiry {
      color: #ef4444;
      font-size: 12px;
      font-weight: 600;
      margin-bottom: 0;
      background-color: rgba(239, 68, 68, 0.1);
      display: inline-block;
      padding: 6px 12px;
      border-radius: 20px;
      border: 1px solid rgba(239, 68, 68, 0.2);
    }
    .footer {
      text-align: center;
      padding: 30px 20px;
      color: #6b7280;
      font-size: 11px;
      line-height: 1.6;
      background-color: #080d17;
      border-top: 1px solid #1f2937;
    }
    .footer p {
      margin: 0 0 10px 0;
    }
    .footer p:last-child {
      margin: 0;
    }
  </style>
</head>
<body>
  <!-- Hidden preheader text for Gmail/Outlook inbox preview -->
  <div style="display:none;font-size:1px;color:#0b111e;line-height:1px;max-height:0px;max-width:0px;opacity:0;overflow:hidden;">${preheader}&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;</div>
  <div class="wrapper">
    <div class="container">
      <div class="header">
        <span class="brand-icon">💰</span>
        <h1 class="brand-title"><span>SmartSpend</span></h1>
      </div>
      <div class="content">
        <h2 class="title">${title}</h2>
        <p class="description">${bodyContent}</p>
        ${otpText ? `<div class="otp-box">${otpText}</div>` : ''}
        ${footerNote ? `<p class="expiry">⚠️ ${footerNote}</p>` : ''}
      </div>
      <div class="footer">
        <p>If you did not request this email, please ignore it.</p>
        <p>© 2026 SmartSpend. All rights reserved.</p>
      </div>
    </div>
  </div>
</body>
</html>
`;
}

/**
 * Robust email sending engine with Resend Priority, Circuit Breaker, and pooled SMTP fallback.
 */
export const sendEmail = async ({ email, subject, message, html, purpose }) => {
    const startTime = performance.now();
    let success = false;
    let provider = 'mock';
    let retryCount = 0;
    let deliveryError = null;

    // 1. Prevent duplicate sends within 10s based on email + purpose
    if (isDuplicateSend(email, purpose, subject)) {
        console.warn(`🛑 [Email Service] Duplicate send prevented for ${email} with purpose/subject: "${purpose || subject}"`);
        return true;
    }

    try {
        const hasSmtp = !!(constants.smtp.email && constants.smtp.password);
        const hasResend = !!process.env.RESEND_API_KEY;

        if (!hasSmtp && !hasResend) {
            if (process.env.NODE_ENV === 'test' && process.env.ALLOW_DEBUG_OTP === 'true') {
                console.log('--- MOCK EMAIL START ---');
                console.log(`To: ${email}`);
                console.log(`Subject: ${subject}`);
                console.log(`Message: ${message}`);
                console.log('--- MOCK EMAIL END ---');
                success = true;
                provider = 'mock';
                return true;
            }
            throw new Error('SMTP and Resend API are not configured');
        }

        // 2. Try Resend API (unless Circuit Breaker is active or Resend is not configured)
        const isResendCircuitOpen = resendCircuitOpenUntil && Date.now() < resendCircuitOpenUntil;
        if (hasResend && !isResendCircuitOpen) {
            provider = 'resend';
            try {
                const res = await fetch('https://api.resend.com/emails', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
                    },
                    body: JSON.stringify({
                        from: 'SmartSpend <onboarding@resend.dev>',
                        to: [email],
                        subject,
                        html,
                        text: message,
                    }),
                });

                if (res.ok) {
                    const data = await res.json();
                    console.log(`✅ [Email Service] Resend sent to ${email} (id: ${data.id})`);
                    success = true;
                    resendConsecutiveFailures = 0;
                    resendCircuitOpenUntil = null;
                    return true;
                } else {
                    const errData = await res.json().catch(() => ({}));
                    throw new Error(JSON.stringify(errData) || `HTTP error ${res.status}`);
                }
            } catch (resErr) {
                resendConsecutiveFailures++;
                console.warn(`⚠️ [Email Service] Resend attempt failed (Consecutive: ${resendConsecutiveFailures}): ${resErr.message}`);
                
                if (resendConsecutiveFailures >= 5) {
                    resendCircuitOpenUntil = Date.now() + 5 * 60 * 1000;
                    console.error(`🚨 [Email Service] Resend circuit breaker opened! Bypassing Resend for 5 minutes.`);
                }
                
                if (!hasSmtp) {
                    throw resErr;
                }
                console.log(`🔄 [Email Service] Resend failed. Falling back to Gmail SMTP...`);
            }
        }

        // 3. Fallback to Gmail SMTP connection pool with exponential backoff retries
        if (hasSmtp && !success) {
            provider = 'gmail_smtp';
            const mailOptions = {
                from: `SmartSpend <${constants.smtp.email || 'noreply@smartspend.dev'}>`,
                to: email,
                subject,
                text: message,
                html,
            };

            let attempts = 0;
            const maxAttempts = 3;
            
            while (attempts < maxAttempts) {
                try {
                    const info = await getTransporter().sendMail(mailOptions);
                    console.log(`✅ [Email Service] SMTP sent to ${email} on attempt ${attempts + 1} (msgId: ${info.messageId})`);
                    success = true;
                    retryCount = attempts;
                    return true;
                } catch (err) {
                    attempts++;
                    retryCount = attempts;
                    console.warn(`⚠️ [Email Service] SMTP attempt ${attempts} failed to ${email}: ${err.message}`);
                    
                    if (attempts < maxAttempts) {
                        const delay = attempts * 750; // Exponential backoff delay
                        await new Promise(r => setTimeout(r, delay));
                    } else {
                        throw err;
                    }
                }
            }
        }

        if (!success) {
            throw new Error('Failed to deliver email through all configured channels');
        }
    } catch (err) {
        deliveryError = err.message;
        throw err;
    } finally {
        const latencyMs = Math.round(performance.now() - startTime);
        // Persist delivery metrics asynchronously to prevent performance overhead
        EmailDeliveryMetric.create({
            email,
            subject,
            success,
            retryCount,
            provider,
            latencyMs,
            error: deliveryError
        }).catch(metricErr => {
            console.error('⚠️ [Email Service] Failed to save delivery metric:', metricErr.message);
        });
    }
};

/**
 * Send a secure, branded 6-digit OTP verification email for registration.
 */
export const sendOtpEmail = async (email, otp) => {
    const subject = 'Your SmartSpend Verification Code';
    const message = `Your verification code is: ${otp}. It will expire in 5 minutes.`;
    const html = getDarkBrandedTemplate(
        'Verify Your Account',
        'Use this code to verify your SmartSpend account.',
        'Welcome to SmartSpend! Please verify your email using the secure 6-digit code below to unlock your financial dashboard.',
        otp,
        'This code will expire in 5 minutes.'
    );

    await sendEmail({ email, subject, message, html, purpose: 'register' });
};

/**
 * Send a secure, branded 6-digit OTP verification email for login.
 */
export const sendLoginOtpEmail = async (email, otp) => {
    const subject = 'Your SmartSpend Login Code';
    const message = `Your login code is: ${otp}. It will expire in 5 minutes.`;
    const html = getDarkBrandedTemplate(
        'Verify Your Login',
        'Use this code to log into your SmartSpend account.',
        'Use the secure 6-digit passcode below to sign into your SmartSpend account instantly — no password required.',
        otp,
        'This code will expire in 5 minutes.'
    );

    await sendEmail({ email, subject, message, html, purpose: 'login' });
};

/**
 * Send transaction alerts and budget threshold warning notifications.
 */
export const sendNotificationEmail = async (email, name, title, textContent) => {
    const subject = `SmartSpend Alert: ${title}`;
    const html = getDarkBrandedTemplate(
        title,
        `SmartSpend Alert: ${title}`,
        `Hi ${name},<br/><br/>${textContent}`,
        '',
        'You can configure these notifications in your SmartSpend settings.'
    );

    await sendEmail({ email, subject, message: textContent, html });
};
