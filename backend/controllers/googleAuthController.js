/**
 * @file controllers/googleAuthController.js
 * @description Google OAuth authentication controller.
 */

import { OAuth2Client } from 'google-auth-library';
import User from '../models/User.js';
import LoginActivityLog from '../models/LoginActivityLog.js';
import { signToken } from '../utils/token.js';
import { issueAuthCookies } from '../utils/authCookies.js';
import { AppError } from '../middleware/errorHandler.js';
import logger from '../config/logger.js';
import crypto from 'crypto';

const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);
const DB_TIMEOUT = 10_000;

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

/** Validate and sanitize Google avatar URL. */
function sanitizeAvatarUrl(url) {
    if (!url) return '';
    try {
        const parsed = new URL(url);
        if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
            return url;
        }
    } catch {
        // Fallback to empty string for safety
    }
    return '';
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

export async function googleAuth(req, res, next) {
    try {
        const { credential } = req.body;
        if (!credential) {
            throw new AppError('Google credential token is required', 400);
        }

        // Verify ID Token securely
        let ticket;
        try {
            ticket = await client.verifyIdToken({
                idToken: credential,
                audience: process.env.GOOGLE_CLIENT_ID
            });
        } catch (verifyErr) {
            logger.error({ err: verifyErr }, 'Google Token verification failed');
            throw new AppError('Invalid Google credential token', 401);
        }

        const payload = ticket.getPayload();
        if (!payload) {
            throw new AppError('Google authentication failed: no payload', 401);
        }

        // Security check: reject if not verified by Google
        if (!payload.email_verified) {
            throw new AppError('Google account email is not verified', 403);
        }

        // Normalize email to prevent Gmail casing issues/duplicates
        const normalizedEmail = payload.email.toLowerCase().trim();
        const googleId = payload.sub;
        const name = payload.name;
        const picture = sanitizeAvatarUrl(payload.picture);

        // Find existing user by normalized email
        let user = await User.findOne({ email: normalizedEmail }).select('+tokenVersion').maxTimeMS(DB_TIMEOUT);

        if (user) {
            // Existing user: merge Google details if missing
            let updated = false;
            if (!user.googleId) {
                user.googleId = googleId;
                updated = true;
            }
            if (!user.avatar && picture) {
                user.avatar = picture;
                user.avatarProvider = 'google';
                updated = true;
            }
            if (!user.avatarProvider) {
                user.avatarProvider = user.avatar ? 'google' : 'local';
                updated = true;
            }
            if (!user.isVerified) {
                user.isVerified = true;
                updated = true;
            }
            if (!user.emailVerifiedAt) {
                user.emailVerifiedAt = new Date();
                updated = true;
            }
            // Safely merge providers list (avoiding replacement)
            if (!user.providers) {
                user.providers = ['local', 'google'];
                updated = true;
            } else if (!user.providers.includes('google')) {
                user.providers.push('google');
                updated = true;
            }
            if (updated) {
                await user.save();
            }
        } else {
            // New user: create Google sign-up
            // Generate a random password hash for schema consistency
            const randomPassword = crypto.randomBytes(32).toString('hex');
            user = await User.create({
                name,
                email: normalizedEmail,
                googleId,
                avatar: picture || '',
                avatarProvider: picture ? 'google' : 'local',
                provider: 'google',
                providers: ['google'],
                isVerified: true,
                emailVerifiedAt: new Date(),
                passwordHash: randomPassword
            });
            // Refetch to select +tokenVersion for token signing stability
            user = await User.findById(user._id).select('+tokenVersion').maxTimeMS(DB_TIMEOUT);
        }

        // Update lastLoginAt on every successful auth
        await User.findByIdAndUpdate(
            user._id,
            { $set: { lastLoginAt: new Date() } }
        ).maxTimeMS(DB_TIMEOUT);

        // Track Login Activity log
        await logLoginActivity(req, user._id, user.email, 'google');

        // Issue secure auth cookies
        const token = signToken(user);
        issueAuthCookies(res, token);

        res.status(200).json({
            success: true,
            user: publicUser(user)
        });
    } catch (err) {
        next(err);
    }
}
