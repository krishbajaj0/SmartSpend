import crypto from 'crypto';
import constants from '../config/constants.js';

export const AUTH_COOKIE = 'smsp_access';
export const CSRF_COOKIE = 'smsp_csrf';

const DEFAULT_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

function jwtMaxAgeMs() {
    const value = String(constants.jwtExpire || '').trim();
    const match = value.match(/^(\d+)([smhd])$/);
    if (!match) return DEFAULT_MAX_AGE_MS;
    const n = Number(match[1]);
    const unit = match[2];
    const multipliers = {
        s: 1000,
        m: 60 * 1000,
        h: 60 * 60 * 1000,
        d: 24 * 60 * 60 * 1000,
    };
    return n * multipliers[unit];
}

function cookieOptions(overrides = {}) {
    return {
        httpOnly: true,
        secure: constants.isProduction,
        sameSite: 'lax',
        path: '/',
        ...overrides,
    };
}

export function issueAuthCookies(res, token) {
    const csrfToken = crypto.randomBytes(32).toString('hex');
    res.cookie(AUTH_COOKIE, token, cookieOptions({ maxAge: jwtMaxAgeMs() }));
    res.cookie(CSRF_COOKIE, csrfToken, cookieOptions({
        httpOnly: false,
        maxAge: jwtMaxAgeMs(),
    }));
}

export function clearAuthCookies(res) {
    res.clearCookie(AUTH_COOKIE, cookieOptions());
    res.clearCookie(CSRF_COOKIE, cookieOptions({ httpOnly: false }));
}

