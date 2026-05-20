/**
 * @file controllers/authController.js
 * @description Local email/password authentication controllers.
 */

import User from '../models/User.js';
import LoginActivityLog from '../models/LoginActivityLog.js';
import { AppError } from '../middleware/errorHandler.js';
import logger from '../config/logger.js';
import { signToken } from '../utils/token.js';
import { invalidateUserCache } from '../middleware/auth.js';
import { clearAuthCookies, issueAuthCookies } from '../utils/authCookies.js';
import { disconnectUserSockets } from '../services/socketService.js';

const DB_TIMEOUT = 10_000;

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Parse client user agent details securely. */
function getDeviceDetails(userAgent) {
    let device = 'Desktop';
    if (/mobile/i.test(userAgent)) device = 'Mobile';
    else if (/tablet/i.test(userAgent)) device = 'Tablet';

    let browser = 'Unknown';
    if (/chrome|crios/i.test(userAgent)) browser = 'Chrome';
    else if (/firefox|fxios/i.test(userAgent)) browser = 'Firefox';
    else if (/safari/i.test(userAgent) && !/chrome|crios/i.test(userAgent)) browser = 'Safari';
    else if (/opr/i.test(userAgent)) browser = 'Opera';
    else if (/edg/i.test(userAgent)) browser = 'Edge';

    let os = 'Unknown';
    if (/windows/i.test(userAgent)) os = 'Windows';
    else if (/macintosh|mac os x/i.test(userAgent)) os = 'macOS';
    else if (/android/i.test(userAgent)) os = 'Android';
    else if (/iphone|ipad|ipod/i.test(userAgent)) os = 'iOS';
    else if (/linux/i.test(userAgent)) os = 'Linux';

    return { device, browser, os };
}

/** Record secure login audit logs. */
async function logLoginActivity(req, userId, email, provider) {
    const ip = req.ip || req.headers['x-forwarded-for'] || req.socket?.remoteAddress || 'unknown';
    const userAgent = req.headers['user-agent'] || '';
    const { device, browser, os } = getDeviceDetails(userAgent);

    try {
        await LoginActivityLog.create({
            userId,
            email,
            ip,
            provider,
            userAgent,
            device,
            browser,
            os
        });
    } catch (err) {
        logger.error({ err }, 'Failed to record login activity log');
    }
}

/** Build the standard public user shape returned in auth responses. */
function publicUser(user) {
    return {
        id:             user._id,
        name:           user.name,
        email:          user.email,
        currency:       user.currency,
        avatar:         user.avatar,
        avatarProvider: user.avatarProvider,
        provider:       user.provider,
        providers:      user.providers,
    };
}

function issueSession(res, user) {
    issueAuthCookies(res, signToken(user));
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
            provider: 'local',
            providers: ['local'],
            avatarProvider: 'local'
        });

        // Refetch to include tokenVersion for signing stability
        user = await User.findById(user._id).select('+tokenVersion').maxTimeMS(DB_TIMEOUT);

        // Update lastLoginAt on every successful registration
        await User.findByIdAndUpdate(
            user._id,
            { $set: { lastLoginAt: new Date() } }
        ).maxTimeMS(DB_TIMEOUT);

        // Record registration activity log
        await logLoginActivity(req, user._id, user.email, 'local');

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

        // Record successful login log
        await logLoginActivity(req, user._id, user.email, 'local');

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
