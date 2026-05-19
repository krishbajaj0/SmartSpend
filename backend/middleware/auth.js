import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import { AppError } from './errorHandler.js';
import constants from '../config/constants.js';
import { parseCookies } from '../utils/cookies.js';
import { AUTH_COOKIE } from '../utils/authCookies.js';

const TTL_MS = 30_000;
const userCache = new Map();

export function invalidateUserCache(userId) {
    userCache.delete(String(userId));
}

async function getUserWithVersion(userId) {
    const id = String(userId);
    const entry = userCache.get(id);
    if (entry && entry.expiresAt > Date.now()) return entry.user;

    const user = await User.findById(userId).select('+tokenVersion');
    if (!user) return null;

    userCache.set(id, {
        user,
        tokenVersion: user.tokenVersion,
        expiresAt: Date.now() + TTL_MS,
    });
    return user;
}

export function extractAuthToken(req) {
    const cookies = parseCookies(req.headers.cookie);
    if (cookies[AUTH_COOKIE]) return cookies[AUTH_COOKIE];

    // Temporary dual-auth migration support. Remove this after all clients use
    // HttpOnly cookies and all legacy localStorage tokens have expired.
    const auth = req.headers.authorization;
    if (auth?.startsWith('Bearer ')) return auth.split(' ')[1];

    return null;
}

export async function verifyAuthToken(token) {
    const decoded = jwt.verify(token, constants.jwtSecret);
    const user = await getUserWithVersion(decoded.id);

    if (!user) {
        invalidateUserCache(decoded.id);
        throw new AppError('User no longer exists', 401);
    }

    const tokenTv = decoded.tv ?? 0;
    if (tokenTv !== user.tokenVersion) {
        invalidateUserCache(decoded.id);
        throw new AppError('Session expired. Please log in again.', 401);
    }

    return { decoded, user };
}

export async function protect(req, _res, next) {
    const token = extractAuthToken(req);
    if (!token) return next(new AppError('Not authorized - no token', 401));

    try {
        const { user } = await verifyAuthToken(token);
        req.user = user;
        next();
    } catch (err) {
        next(err);
    }
}

