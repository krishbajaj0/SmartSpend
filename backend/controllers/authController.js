/**
 * @file controllers/authController.js
 *
 * Phase 1 hardening applied:
 *  - OTP stored as HMAC-SHA256 hash (utils/otp.js)
 *  - JWT revocation via tokenVersion (utils/token.js)
 *
 * Phase 2 hardening applied:
 *
 *  ATOMIC OTP VERIFICATION (P1-1)
 *  ────────────────────────────────
 *  The original read-then-write pattern:
 *    1. findOne(email, otpExpire: { $gt: now })   ← read
 *    2. check attempts in JS
 *    3. user.save()                                ← write
 *
 *  has a TOCTOU race: two concurrent requests both pass step 1 before
 *  either completes step 3. Both increment from the same base, bypassing
 *  the 5-attempt lockout.
 *
 *  Fixed pattern — every verification function now:
 *    1. findOneAndUpdate({ email, otpExpire > now, otpAttempts < 5 },
 *                        { $inc: { otpAttempts: 1 } }, { new: true })
 *       → atomic: increments the counter OR returns null (no match).
 *       → if null: either expired, max attempts reached, or wrong email.
 *    2. verifyOtp(candidateOtp, user.otp) in application code.
 *    3. On success: findOneAndUpdate({ _id }, { $unset: OTP fields }).
 *       → clears the OTP in one atomic write; no second findOne needed.
 *
 *  No two concurrent requests can both succeed step 1 because MongoDB's
 *  document-level locking guarantees the findOneAndUpdate is serialised.
 *
 *  QUERY TIMEOUT (P1-2)
 *  ─────────────────────
 *  All DB operations use .maxTimeMS(10_000) to prevent queries from
 *  holding connections indefinitely when MongoDB is under load.
 */

import crypto from 'crypto';
import User from '../models/User.js';
import { AppError } from '../middleware/errorHandler.js';
import logger from '../config/logger.js';
import { hashOtp } from '../utils/otp.js';
import { signToken } from '../utils/token.js';
import { sendOtpEmail, sendLoginOtpEmail } from '../services/emailService.js';
import { invalidateUserCache } from '../middleware/auth.js';
import { clearAuthCookies, issueAuthCookies } from '../utils/authCookies.js';
import { disconnectUserSockets } from '../services/socketService.js';

// ── DB query timeout (ms) applied to all auth queries ──────────────────────────
// Set lower than the global HTTP timeout (30 s) so we get a clean DB error
// before the HTTP layer times out and destroys the socket.
const DB_TIMEOUT = 10_000;

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────

/** Generate a cryptographically secure 6-digit OTP string. */
function generateOtp() {
    return crypto.randomInt(100000, 999999).toString();
}

/**
 * Build the standard public user shape returned in auth responses.
 * Keeps response payloads consistent across all endpoints.
 */
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

/**
 * Fully atomic OTP verification — verify AND consume in ONE MongoDB operation.
 *
 * WHY THE PHASE 2 APPROACH STILL HAD A RACE
 * ──────────────────────────────────────────
 * Phase 2 used findOneAndUpdate to increment the attempt counter atomically,
 * then verified the hash in JS, then cleared the OTP in a second write.
 * The race window: between the $inc write and the JS hash check, TWO concurrent
 * requests with the *same valid OTP* can both pass the filter (both have
 * attempts < 5), both get the document, both run verifyOtpHash() → true, and
 * both proceed to "OTP is valid" — consuming the same OTP twice.
 *
 * THE FIX — SINGLE OPERATION
 * ──────────────────────────
 * The OTP hash is computed in JS (necessary — MongoDB cannot run HMAC), then
 * passed directly into the findOneAndUpdate FILTER:
 *
 *   filter: { email, otp: hashedValue, otpExpire > now, otpAttempts < limit }
 *   update: { $unset OTP fields, $set lastLoginAt (if applicable) }
 *
 * If this returns a document: the OTP matched AND was cleared atomically.
 * If it returns null: either expired, wrong hash, locked, or not found.
 * No second request can match the same OTP because the $unset fires in the
 * same operation — there is NO window between match and consume.
 *
 * ON FAILURE (null returned):
 * We do a second targeted $inc to bump the attempt counter. This is NOT
 * a race issue on the failure path because we only care about monotonically
 * incrementing the counter — concurrent failures both increment safely.
 *
 * @param {string} email        - User email
 * @param {string} submittedOtp - Plaintext OTP from request body
 * @param {string} extraSelect  - Additional Mongoose select fields (e.g. '+tokenVersion')
 * @returns {Document} Matched and consumed user document
 * @throws {AppError} 400/429 on invalid/expired/locked OTP
 */
async function atomicVerifyOtp(email, submittedOtp, extraSelect = '') {
    const hashedOtp = hashOtp(submittedOtp);
    const now       = new Date();

    // ── SINGLE ATOMIC OPERATION: match + clear ────────────────────────────────
    // The filter includes the hashed OTP value directly.
    // If MongoDB finds a document matching ALL conditions, it atomically:
    //   1. Unsets otp, otpExpire, otpAttempts (consumed — cannot be reused)
    // No two concurrent requests can both succeed this operation for the same OTP.
    const user = await User.findOneAndUpdate(
        {
            email,
            otp:         hashedOtp,               // hash match inside DB — never in JS
            otpExpire:   { $gt: now },             // not expired
            otpAttempts: { $lt: 5 },              // not locked out
        },
        {
            $unset: { otp: '', otpExpire: '', otpAttempts: '' },
        },
        {
            new:    true,
            select: extraSelect.trim() || undefined,
        }
    ).maxTimeMS(DB_TIMEOUT);

    if (user) {
        // Match succeeded — OTP was valid and is now consumed.
        return user;
    }

    // ── MATCH FAILED — determine why and update attempt counter ───────────────
    // We need to increment the attempt counter on the CORRECT document
    // (the one with this email and a still-valid OTP), but only if it exists
    // and isn't already locked. We do NOT need to know why it failed here —
    // the user-facing message is intentionally generic to prevent enumeration.
    const failDoc = await User.findOneAndUpdate(
        {
            email,
            otpExpire:   { $gt: now },     // still has an active (non-expired) OTP
            otpAttempts: { $lt: 5 },       // not yet fully locked
        },
        { $inc: { otpAttempts: 1 } },
        {
            new:    true,
            select: '+otpAttempts',
        }
    ).maxTimeMS(DB_TIMEOUT);

    if (failDoc && failDoc.otpAttempts >= 5) {
        // This increment just reached the limit — clear the OTP so it can't
        // be retried further and give a specific lockout message.
        await User.findByIdAndUpdate(
            failDoc._id,
            { $unset: { otp: '', otpExpire: '' }, $set: { otpAttempts: 0 } }
        ).maxTimeMS(DB_TIMEOUT);
        throw new AppError('Too many failed attempts. Please request a new OTP.', 429);
    }

    if (failDoc) {
        const remaining = 5 - failDoc.otpAttempts;
        throw new AppError(
            `Invalid OTP. ${remaining} attempt${remaining !== 1 ? 's' : ''} remaining.`,
            400
        );
    }

    // No active OTP document found at all: expired, locked, or wrong email.
    throw new AppError('Invalid or expired OTP.', 400);
}

// ─────────────────────────────────────────────────────────────────────────────
export async function register(req, res, next) {
    try {
        const { name, email, password } = req.body;

        const exists = await User.findOne({ email }).maxTimeMS(DB_TIMEOUT);
        if (exists) {
            return res.status(409).json({ success: false, message: 'Email already registered' });
        }

        // Temporarily set isVerified: true to fully bypass SMTP verification in production
        const user = await User.create({
            name,
            email,
            passwordHash: password,
            otp:          null,
            otpExpire:    null,
            otpAttempts:  0,
            isVerified:   true,
        });

        // Issue session token cookies directly upon successful signup
        issueSession(res, user);

        return res.status(201).json({
            success: true,
            message: 'Registration successful.',
            user:    publicUser(user),
        });
    } catch (err) {
        if (res.headersSent) return;
        return next(err);
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/auth/login
// ─────────────────────────────────────────────────────────────────────────────
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

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/auth/logout
// ─────────────────────────────────────────────────────────────────────────────
export async function logout(req, res, next) {
    try {
        // Atomic tokenVersion increment invalidates all current sessions for this user.
        await User.findByIdAndUpdate(
            req.user._id,
            { $inc: { tokenVersion: 1 } }
        ).maxTimeMS(DB_TIMEOUT);
        
        // Evict cache to ensure next request goes to DB and hits new tokenVersion
        invalidateUserCache(req.user._id);
        disconnectUserSockets(req.user._id);
        clearAuthCookies(res);

        res.json({ success: true, message: 'Logged out successfully' });
    } catch (err) { next(err); }
}

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/auth/login-otp  (request login OTP)
// ─────────────────────────────────────────────────────────────────────────────
export async function requestLoginOtp(req, res, next) {
    try {
        const { email } = req.body;

        const user = await User.findOne({ email }).maxTimeMS(DB_TIMEOUT);
        if (!user) throw new AppError('No account found with that email', 404);

        if (!user.isVerified) {
            throw new AppError('Please verify your email first', 403);
        }

        const plainOtp = generateOtp();
        await User.findByIdAndUpdate(
            user._id,
            {
                $set: {
                    otp:         hashOtp(plainOtp),
                    otpExpire:   new Date(Date.now() + 10 * 60 * 1000),
                    otpAttempts: 0,
                },
            }
        ).maxTimeMS(DB_TIMEOUT);

        await sendLoginOtpEmail(email, plainOtp);

        res.json({ success: true, message: 'Login OTP sent to your email' });
    } catch (err) { next(err); }
}

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/auth/verify-login-otp
// ─────────────────────────────────────────────────────────────────────────────
export async function verifyLoginOtp(req, res, next) {
    try {
        const { email, otp } = req.body;

        // atomicVerifyOtp handles: expiry check, attempt limiting (atomic),
        // hash verification, and OTP clearing — all in one round trip + one write.
        const user = await atomicVerifyOtp(email, otp, '+tokenVersion');

        // Update lastLoginAt after successful verification
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

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/auth/me
// ─────────────────────────────────────────────────────────────────────────────
export async function getMe(req, res) {
    res.json({ success: true, user: req.user });
}

// ─────────────────────────────────────────────────────────────────────────────
// PUT /api/auth/profile
// ─────────────────────────────────────────────────────────────────────────────
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

// ─────────────────────────────────────────────────────────────────────────────
// PUT /api/auth/change-password
// ─────────────────────────────────────────────────────────────────────────────
export async function changePassword(req, res, next) {
    try {
        const { oldPassword, newPassword } = req.body;

        const user = await User.findById(req.user._id)
            .select('+passwordHash +tokenVersion')
            .maxTimeMS(DB_TIMEOUT);

        const isMatch = await user.comparePassword(oldPassword);
        if (!isMatch) throw new AppError('Current password is incorrect', 400);

        user.passwordHash = newPassword;
        await user.save(); // pre-save hook hashes the new password

        // Revoke all old sessions by incrementing tokenVersion
        const updatedUser = await User.findByIdAndUpdate(
            user._id,
            { $inc: { tokenVersion: 1 } },
            { new: true, select: '+tokenVersion' }
        ).maxTimeMS(DB_TIMEOUT);

        // Evict the now-stale cache entry so the next request re-queries the DB
        invalidateUserCache(user._id);
        disconnectUserSockets(user._id);
        issueSession(res, updatedUser);

        res.json({
            success: true,
            message: 'Password updated. All other sessions have been invalidated.',
        });
    } catch (err) { next(err); }
}

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/auth/forgot-password
// ─────────────────────────────────────────────────────────────────────────────
export async function forgotPassword(req, res, next) {
    try {
        const user = await User.findOne({ email: req.body.email }).maxTimeMS(DB_TIMEOUT);
        // Constant-message response: never reveal whether the email exists
        const successResponse = { success: true, message: 'If that email exists, an OTP has been sent.' };

        if (!user) return res.json(successResponse);

        const plainOtp = generateOtp();
        await User.findByIdAndUpdate(
            user._id,
            {
                $set: {
                    otp:         hashOtp(plainOtp),
                    otpExpire:   new Date(Date.now() + 10 * 60 * 1000),
                    otpAttempts: 0,
                },
            }
        ).maxTimeMS(DB_TIMEOUT);

        await sendOtpEmail(user.email, plainOtp);

        res.json(successResponse);
    } catch (err) { next(err); }
}

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/auth/reset-password
// ─────────────────────────────────────────────────────────────────────────────
export async function resetPassword(req, res, next) {
    try {
        const { email, otp, newPassword } = req.body;

        // atomicVerifyOtp: same atomic pattern, no tokenVersion needed yet
        // (we'll fetch it atomically with the password update below)
        const user = await atomicVerifyOtp(email, otp, '');

        // Hash the new password and bump tokenVersion in one save sequence.
        // We can't do this in a single findByIdAndUpdate because the pre-save
        // hook for bcrypt runs on save() — so we use a Mongoose document.
        const fullUser = await User.findById(user._id)
            .select('+passwordHash +tokenVersion')
            .maxTimeMS(DB_TIMEOUT);

        fullUser.passwordHash = newPassword;
        fullUser.isVerified   = true;
        await fullUser.save(); // bcrypt hook fires here

        // Revoke all old sessions — account recovery invalidates everything
        await User.findByIdAndUpdate(
            fullUser._id,
            { $inc: { tokenVersion: 1 } }
        ).maxTimeMS(DB_TIMEOUT);

        // Evict stale cache entry
        invalidateUserCache(fullUser._id);
        disconnectUserSockets(fullUser._id);
        clearAuthCookies(res);

        res.json({ success: true, message: 'Password reset successful. Please log in again.' });
    } catch (err) { next(err); }
}

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/auth/verify-otp  (email verification after registration)
// ─────────────────────────────────────────────────────────────────────────────
export async function verifyOtp(req, res, next) {
    try {
        const { email, otp } = req.body;

        const user = await atomicVerifyOtp(email, otp, '+tokenVersion');

        // Mark account as verified — one targeted update, no save() overhead
        await User.findByIdAndUpdate(
            user._id,
            { $set: { isVerified: true } }
        ).maxTimeMS(DB_TIMEOUT);

        // Re-read to get clean user state for the token and response
        const verifiedUser = await User.findById(user._id)
            .select('+tokenVersion')
            .maxTimeMS(DB_TIMEOUT);

        issueSession(res, verifiedUser);
        res.json({
            success: true,
            message: 'Email verified successfully',
            user: {
                id:       verifiedUser._id,
                name:     verifiedUser.name,
                email:    verifiedUser.email,
                currency: verifiedUser.currency,
            },
        });
    } catch (err) { next(err); }
}

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/auth/resend-otp
// ─────────────────────────────────────────────────────────────────────────────
export async function resendOtp(req, res, next) {
    try {
        const { email } = req.body;
        const user = await User.findOne({ email }).maxTimeMS(DB_TIMEOUT);
        if (!user) throw new AppError('User not found', 404);

        const plainOtp = generateOtp();
        await User.findByIdAndUpdate(
            user._id,
            {
                $set: {
                    otp:         hashOtp(plainOtp),
                    otpExpire:   new Date(Date.now() + 10 * 60 * 1000),
                    otpAttempts: 0,   // reset counter on resend
                },
            }
        ).maxTimeMS(DB_TIMEOUT);

        await sendOtpEmail(email, plainOtp);

        res.json({ success: true, message: 'OTP resent to your email' });
    } catch (err) { next(err); }
}
