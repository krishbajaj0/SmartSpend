/**
 * @file routes/auth.js
 *
 * Rate limiting strategy:
 *  - authLimiter  (10 req/min)   — register, login, forgot-password, login-otp
 *  - otpLimiter   (5 req/15min)  — OTP submission and resend routes only
 *
 * OTP routes get a STRICTER limiter because:
 *  1. They are the most valuable brute-force target (6-digit space = 1M values)
 *  2. Resend endpoints can be abused to spam email addresses
 *  3. The atomic DB-level lockout (5 attempts) is per-account; the rate limiter
 *     is per-IP. Together they defend against both single-account and distributed attacks.
 *
 * The otpLimiter uses a 15-minute window (matching OTP expiry) so that a
 * locked-out IP cannot refresh its window and try again before the OTP expires.
 */

import express from 'express';
import {
    register, login, logout, getMe, updateProfile, changePassword, loadDemoAccount,
} from '../controllers/authController.js';
import { googleAuth } from '../controllers/googleAuthController.js';
import { protect } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import rateLimit from 'express-rate-limit';
import constants from '../config/constants.js';

const router = express.Router();

// General auth limiter: 10 requests / minute per IP
const authLimiter = rateLimit({
    windowMs:        constants.rateLimit.auth.windowMs,
    max:             constants.rateLimit.auth.max,
    standardHeaders: true,
    legacyHeaders:   false,
    message: { success: false, message: 'Too many auth attempts. Please try again later.' },
});

// OTP-specific limiter: 5 requests / 15 minutes per IP
// Applied to verify, reset, and resend routes — not to request/send routes
// (those already go through authLimiter and are constrained by SMTP costs).
const otpLimiter = rateLimit({
    windowMs:        constants.rateLimit.otp.windowMs,
    max:             constants.rateLimit.otp.max,
    standardHeaders: true,
    legacyHeaders:   false,
    message: { success: false, message: 'Too many OTP attempts. Please wait 15 minutes before trying again.' },
});

// ── Public routes ─────────────────────────────────────────────────────────────

router.post('/register', authLimiter, validate({
    name:     { required: true, type: 'string', minLength: 2 },
    email:    { required: true, type: 'email' },
    password: { required: true, type: 'string', minLength: 6 },
}), register);

router.post('/login', authLimiter, validate({
    email:    { required: true, type: 'email' },
    password: { required: true, type: 'string' },
}), login);

router.post('/demo/load', authLimiter, loadDemoAccount);

router.post('/google', authLimiter, validate({
    credential: { required: true, type: 'string' },
}), googleAuth);

// Forgot-password and Reset-password routes have been temporarily disabled.
// router.post('/forgot-password', authLimiter, ...);
// router.post('/reset-password', otpLimiter, ...);

// ── Protected routes ──────────────────────────────────────────────────────────

router.get('/me', protect, getMe);
router.post('/logout', protect, logout);
router.put('/profile', protect, updateProfile);
router.put('/change-password', protect, validate({
    oldPassword: { required: true, type: 'string' },
    newPassword: { required: true, type: 'string', minLength: 6 },
}), changePassword);

export default router;
