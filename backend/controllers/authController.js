/**
 * @file controllers/authController.js
 *
 * Fully decoupled OTP architecture, security auditing, and delivery telemetry suite.
 */

import crypto from 'crypto';
import User from '../models/User.js';
import OtpVerification from '../models/OtpVerification.js';
import OtpAttemptAudit from '../models/OtpAttemptAudit.js';
import { AppError } from '../middleware/errorHandler.js';
import logger from '../config/logger.js';
import { hashOtp } from '../utils/otp.js';
import { signToken } from '../utils/token.js';
import { sendOtpEmail } from '../services/emailService.js';
import { invalidateUserCache } from '../middleware/auth.js';
import { clearAuthCookies, issueAuthCookies } from '../utils/authCookies.js';
import { disconnectUserSockets } from '../services/socketService.js';

const DB_TIMEOUT = 10_000;

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Generate a cryptographically secure 6-digit OTP string. */
function generateOtp() {
    return crypto.randomInt(100000, 999999).toString();
}

/** Build the standard public user shape returned in auth responses. */
function publicUser(user) {
    return {
        id:       user._id,
        name:     user.name,
        email:    user.email,
        currency: user.currency,
        avatar:   user.avatar,
    };
}

function issueSession(res, user) {
    issueAuthCookies(res, signToken(user));
}

/** Parse client telemetry details and log secure security audits. */
async function logOtpAttempt(req, email, action, success, reason = null) {
    const ip = req.ip || req.headers['x-forwarded-for'] || req.socket?.remoteAddress || 'unknown';
    const userAgent = req.headers['user-agent'] || '';
    
    let device = 'Desktop';
    if (/mobile/i.test(userAgent)) device = 'Mobile';
    else if (/tablet/i.test(userAgent)) device = 'Tablet';

    try {
        await OtpAttemptAudit.create({
            email,
            action,
            success,
            reason,
            ip,
            userAgent,
            device,
            country: 'unknown'
        });
    } catch (err) {
        console.error('⚠️ [Auth Controller] Failed to log OTP attempt audit:', err.message);
    }
}

/**
 * Fully atomic OTP verification — verify AND consume in ONE MongoDB operation on the OtpVerification model.
 *
 * @param {string} email        - User email
 * @param {string} purpose      - The specific OTP purpose ('register', 'login', 'forgot_password')
 * @param {string} submittedOtp - Plaintext OTP from request body
 * @param {Object} req          - Express req object for audit log extraction
 * @param {string} extraSelect  - Additional Mongoose select fields (e.g. '+tokenVersion')
 * @returns {Document} Matched and consumed user document
 * @throws {AppError} 400/429 on invalid/expired/locked OTP
 */
async function atomicVerifyOtp(email, purpose, submittedOtp, req, extraSelect = '') {
    const hashedOtp = hashOtp(submittedOtp);
    const now       = new Date();

    // Check if verification is currently locked
    const lockedOtp = await OtpVerification.findOne({
        email,
        purpose,
        lockUntil: { $gt: now }
    }).maxTimeMS(DB_TIMEOUT);

    if (lockedOtp) {
        const minutesLeft = Math.ceil((lockedOtp.lockUntil - now) / 60000);
        await logOtpAttempt(req, email, `verify_${purpose}_otp`, false, 'locked_out');
        throw new AppError(`Verification is locked due to too many failed attempts. Please try again in ${minutesLeft} minute(s).`, 429);
    }

    // ── SINGLE ATOMIC OPERATION: match + clear ────────────────────────────────
    // The filter includes the hashed OTP value directly.
    // If MongoDB finds a document matching ALL conditions, it atomically deletes the OTP document.
    const verification = await OtpVerification.findOneAndDelete({
        email,
        purpose,
        otpHash:     hashedOtp,               // hash match inside DB
        expiresAt:   { $gt: now },            // not expired
        attempts:    { $lt: 5 },              // not locked out
    }).maxTimeMS(DB_TIMEOUT);

    if (verification) {
        // Match succeeded — OTP was valid and is now consumed.
        // Fetch and return the corresponding User
        const user = await User.findOne({ email }).select(extraSelect.trim() || undefined).maxTimeMS(DB_TIMEOUT);
        if (!user) {
            await logOtpAttempt(req, email, `verify_${purpose}_otp`, false, 'user_not_found');
            throw new AppError('Associated user not found.', 404);
        }
        await logOtpAttempt(req, email, `verify_${purpose}_otp`, true);
        return user;
    }

    // ── MATCH FAILED — determine why and update attempt counter ───────────────
    const failDoc = await OtpVerification.findOneAndUpdate(
        {
            email,
            purpose,
            expiresAt: { $gt: now },     // still has an active (non-expired) OTP
            attempts:  { $lt: 5 },       // not yet fully locked
        },
        { $inc: { attempts: 1 } },
        {
            new:    true,
            select: '+attempts',
        }
    ).maxTimeMS(DB_TIMEOUT);

    if (failDoc && failDoc.attempts >= 5) {
        // Lock verification for 15 minutes by setting lockUntil and updating expiresAt
        const lockUntil = new Date(Date.now() + 15 * 60 * 1000);
        await OtpVerification.findByIdAndUpdate(
            failDoc._id,
            { 
                $set: { 
                    attempts: 0,
                    lockUntil: lockUntil,
                    expiresAt: lockUntil // Extend collection TTL dynamic index
                },
                $unset: { otpHash: '' } // Delete sensitive OTP hash component
            }
        ).maxTimeMS(DB_TIMEOUT);
        await logOtpAttempt(req, email, `verify_${purpose}_otp`, false, 'lockout_triggered');
        throw new AppError('Too many failed attempts. Verification is locked for 15 minutes.', 429);
    }

    if (failDoc) {
        const remaining = 5 - failDoc.attempts;
        await logOtpAttempt(req, email, `verify_${purpose}_otp`, false, 'invalid_otp');
        const err = new AppError(
            `Invalid OTP. ${remaining} attempt${remaining !== 1 ? 's' : ''} remaining.`,
            400
        );
        err.attemptsRemaining = remaining;
        throw err;
    }

    // No active OTP document found at all: expired, locked, or wrong email.
    await logOtpAttempt(req, email, `verify_${purpose}_otp`, false, 'invalid_or_expired');
    throw new AppError('Invalid or expired OTP.', 400);
}

// ── Controllers ──────────────────────────────────────────────────────────────

export async function register(req, res, next) {
    try {
        const { name, email, password } = req.body;
        const normalizedEmail = email.toLowerCase().trim();

        const exists = await User.findOne({ email: normalizedEmail }).maxTimeMS(DB_TIMEOUT);
        if (exists) {
            return res.status(409).json({ success: false, message: 'Email already registered' });
        }

        let user = await User.create({
            name,
            email: normalizedEmail,
            passwordHash: password,
            isVerified:   true,
            emailVerifiedAt: new Date(),
        });

        // Refetch to include tokenVersion for signing stability
        user = await User.findById(user._id).select('+tokenVersion').maxTimeMS(DB_TIMEOUT);

        // Update lastLoginAt
        await User.findByIdAndUpdate(
            user._id,
            { $set: { lastLoginAt: new Date() } }
        ).maxTimeMS(DB_TIMEOUT);

        issueSession(res, user);
        return res.status(201).json({
            success: true,
            user:    publicUser(user),
        });
    } catch (err) {
        if (res.headersSent) return;
        return next(err);
    }
}

export async function login(req, res, next) {
    try {
        const { email, password } = req.body;

        const user = await User.findOne({ email })
            .select('+passwordHash +tokenVersion')
            .maxTimeMS(DB_TIMEOUT);
        if (!user) throw new AppError('Invalid credentials', 401);

        const isMatch = await user.comparePassword(password);
        if (!isMatch) throw new AppError('Invalid credentials', 401);

        if (!user.isVerified) {
            throw new AppError('Please verify your email first', 403);
        }

        // Update lastLoginAt without triggering full validation
        await User.findByIdAndUpdate(
            user._id,
            { $set: { lastLoginAt: new Date() } }
        ).maxTimeMS(DB_TIMEOUT);

        issueSession(res, user);
        res.json({
            success: true,
            user:    publicUser(user),
        });
    } catch (err) { next(err); }
}

export async function logout(req, res, next) {
    try {
        await User.findByIdAndUpdate(
            req.user._id,
            { $inc: { tokenVersion: 1 } }
        ).maxTimeMS(DB_TIMEOUT);
        
        invalidateUserCache(req.user._id);
        disconnectUserSockets(req.user._id);
        clearAuthCookies(res);

        res.json({ success: true, message: 'Logged out successfully' });
    } catch (err) { next(err); }
}



export async function getMe(req, res) {
    res.json({ success: true, user: req.user });
}

export async function updateProfile(req, res, next) {
    try {
        const allowed = [
            'name', 'avatar', 'currency',
            'monthlyIncomeEstimate', 'themePreference', 'notificationPreferences',
        ];
        const updates = {};
        for (const key of allowed) {
            if (req.body[key] !== undefined) updates[key] = req.body[key];
        }
        const user = await User.findByIdAndUpdate(
            req.user._id, updates, { new: true, runValidators: true }
        ).maxTimeMS(DB_TIMEOUT);
        res.json({ success: true, user });
    } catch (err) { next(err); }
}

export async function changePassword(req, res, next) {
    try {
        const { oldPassword, newPassword } = req.body;

        const user = await User.findById(req.user._id)
            .select('+passwordHash +tokenVersion')
            .maxTimeMS(DB_TIMEOUT);

        const isMatch = await user.comparePassword(oldPassword);
        if (!isMatch) throw new AppError('Current password is incorrect', 400);

        user.passwordHash = newPassword;
        await user.save(); 

        const updatedUser = await User.findByIdAndUpdate(
            user._id,
            { $inc: { tokenVersion: 1 } },
            { new: true, select: '+tokenVersion' }
        ).maxTimeMS(DB_TIMEOUT);

        invalidateUserCache(user._id);
        disconnectUserSockets(user._id);
        issueSession(res, updatedUser);

        res.json({
            success: true,
            message: 'Password updated. All other sessions have been invalidated.',
        });
    } catch (err) { next(err); }
}

export async function forgotPassword(req, res, next) {
    try {
        const user = await User.findOne({ email: req.body.email }).maxTimeMS(DB_TIMEOUT);
        const successResponse = { success: true, message: 'If that email exists, an OTP has been sent.' };

        if (!user) return res.json(successResponse);

        const now = new Date();

        // 1. Check if forgot password verification is currently locked
        const existingOtp = await OtpVerification.findOne({ email: user.email, purpose: 'forgot_password' }).maxTimeMS(DB_TIMEOUT);

        if (existingOtp && existingOtp.lockUntil && existingOtp.lockUntil > now) {
            const minutesLeft = Math.ceil((existingOtp.lockUntil - now) / 60000);
            await logOtpAttempt(req, user.email, 'forgot_password_otp', false, 'locked_out');
            throw new AppError(`Verification is locked due to too many failed attempts. Please try again in ${minutesLeft} minute(s).`, 429);
        }

        // 2. Enforce 60-second resend cooldown
        if (existingOtp && existingOtp.lastSentAt && (now - existingOtp.lastSentAt) < 60000) {
            const secondsLeft = Math.ceil((60000 - (now - existingOtp.lastSentAt)) / 1000);
            await logOtpAttempt(req, user.email, 'forgot_password_otp', false, 'cooldown_active');
            const err = new AppError(`Please wait ${secondsLeft} second(s) before requesting another OTP.`, 429);
            err.secondsLeft = secondsLeft;
            throw err;
        }

        const plainOtp = generateOtp();
        const expiresAt = new Date(now.getTime() + 5 * 60 * 1000); // 5 minutes expiry

        // Invalidate old forgot_password OTP records
        await OtpVerification.deleteMany({ email: user.email, purpose: 'forgot_password' }).maxTimeMS(DB_TIMEOUT);

        // Store new password reset code conforming exactly to required schema
        await OtpVerification.create({
            userId: user._id,
            email: user.email,
            purpose: 'forgot_password',
            otpHash: hashOtp(plainOtp),
            attempts: 0,
            maxAttempts: 5,
            lastSentAt: now,
            expiresAt,
            verified: false,
            ip: req.ip || req.headers['x-forwarded-for'] || req.socket?.remoteAddress || 'unknown',
            userAgent: req.headers['user-agent'] || ''
        });

        await logOtpAttempt(req, user.email, 'forgot_password_otp', true);

        await sendOtpEmail(user.email, plainOtp);

        res.json(successResponse);
    } catch (err) { next(err); }
}

export async function resetPassword(req, res, next) {
    try {
        const { email, otp, newPassword } = req.body;

        const user = await atomicVerifyOtp(email, 'forgot_password', otp, req, '');

        const fullUser = await User.findById(user._id)
            .select('+passwordHash +tokenVersion')
            .maxTimeMS(DB_TIMEOUT);

        fullUser.passwordHash = newPassword;
        fullUser.isVerified   = true;
        await fullUser.save(); 

        await User.findByIdAndUpdate(
            fullUser._id,
            { $inc: { tokenVersion: 1 } }
        ).maxTimeMS(DB_TIMEOUT);

        invalidateUserCache(fullUser._id);
        disconnectUserSockets(fullUser._id);
        clearAuthCookies(res);

        res.json({ success: true, message: 'Password reset successful. Please log in again.' });
    } catch (err) { next(err); }
}


