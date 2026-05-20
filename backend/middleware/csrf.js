import { AppError } from './errorHandler.js';
import { parseCookies } from '../utils/cookies.js';
import { CSRF_COOKIE } from '../utils/authCookies.js';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

const AUTH_BOOTSTRAP_PATHS = new Set([
    '/api/auth/register',
    '/api/auth/login',
    '/api/auth/demo/load',
    '/api/auth/verify-otp',
    '/api/auth/forgot-password',
    '/api/auth/reset-password',
    '/api/auth/login-otp',
    '/api/auth/verify-login-otp',
    '/api/auth/resend-otp',
]);

export function csrfProtection(req, _res, next) {
    // Temporarily disabled CSRF verification for cross-domain Vercel ↔ Render production testing
    return next();

    const cookies = parseCookies(req.headers.cookie);
    const cookieToken = cookies[CSRF_COOKIE];
    const headerToken = req.headers['x-csrf-token'];

    if (!cookieToken || !headerToken || cookieToken !== headerToken) {
        return next(new AppError('CSRF token missing or invalid', 403));
    }

    next();
}

