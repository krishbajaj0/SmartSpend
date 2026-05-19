/**
 * @file config/constants.js
 * @description Centralised, validated application configuration.
 *
 * Design decisions:
 *  - ALL required env vars are validated at module import time (fail-fast).
 *    If any are missing the process exits before a single route is registered.
 *  - Optional vars have safe, documented defaults.
 *  - Nothing in this file is hardcoded — every value comes from the environment.
 *  - Constants are exported as a frozen object to prevent accidental mutation
 *    at runtime (Object.freeze is shallow; nested objects are also frozen).
 */

import logger from './logger.js';

// ── Required env-var validation ───────────────────────────────────────────────
const REQUIRED = ['MONGO_URI', 'JWT_SECRET', 'OTP_HMAC_SECRET'];
const missing = REQUIRED.filter((k) => !process.env[k]);
if (missing.length) {
    // Log every missing variable before exiting so the operator can fix them all
    // in one cycle instead of discovering them one by one.
    logger.fatal(`FATAL: Missing required environment variables: ${missing.join(', ')}`);
    process.exit(1);
}

// ── Secret strength checks ────────────────────────────────────────────────────
if (process.env.JWT_SECRET.length < 32) {
    logger.fatal('FATAL: JWT_SECRET must be at least 32 characters. Use a cryptographically random value.');
    process.exit(1);
}
if (process.env.OTP_HMAC_SECRET.length < 32) {
    logger.fatal('FATAL: OTP_HMAC_SECRET must be at least 32 characters. Use a cryptographically random value.');
    process.exit(1);
}

const NUMERIC_ENV = [
    'ANALYTICS_DEGRADE_ENTER_MS',
    'ANALYTICS_DEGRADE_EXIT_MS',
    'ANALYTICS_DEGRADE_MIN_SAMPLES',
    'ANALYTICS_DEGRADE_MIN_HOLD_MS',
    'ANALYTICS_DEGRADE_COOLDOWN_MS',
];
for (const key of NUMERIC_ENV) {
    if (process.env[key] !== undefined && (!Number.isFinite(Number(process.env[key])) || Number(process.env[key]) <= 0)) {
        logger.fatal(`FATAL: ${key} must be a positive number.`);
        process.exit(1);
    }
}
if (
    process.env.ANALYTICS_DEGRADE_ENTER_MS !== undefined
    && process.env.ANALYTICS_DEGRADE_EXIT_MS !== undefined
    && Number(process.env.ANALYTICS_DEGRADE_EXIT_MS) >= Number(process.env.ANALYTICS_DEGRADE_ENTER_MS)
) {
    logger.fatal('FATAL: ANALYTICS_DEGRADE_EXIT_MS must be lower than ANALYTICS_DEGRADE_ENTER_MS to prevent flapping.');
    process.exit(1);
}

// ── Freeze helper (deep-freezes plain objects) ───────────────────────────────
function deepFreeze(obj) {
    Object.getOwnPropertyNames(obj).forEach((name) => {
        const val = obj[name];
        if (val && typeof val === 'object') deepFreeze(val);
    });
    return Object.freeze(obj);
}

// ── Exported constants ────────────────────────────────────────────────────────
const constants = deepFreeze({
    // Server
    port: parseInt(process.env.PORT ?? '5000', 10),
    nodeEnv: process.env.NODE_ENV ?? 'development',
    isProduction: process.env.NODE_ENV === 'production',

    // Database
    mongoUri: process.env.MONGO_URI,
    db: {
        poolMax: parseInt(process.env.DB_POOL_MAX ?? '10', 10),
        poolMin: parseInt(process.env.DB_POOL_MIN ?? '2', 10),
    },

    // Auth
    jwtSecret: process.env.JWT_SECRET,
    jwtExpire: process.env.JWT_EXPIRE ?? '7d',
    bcryptSaltRounds: parseInt(process.env.BCRYPT_ROUNDS ?? '12', 10),
    otpHmacSecret: process.env.OTP_HMAC_SECRET,

    // CORS
    frontendUrl: process.env.FRONTEND_URL ?? 'http://localhost:5173',

    // Pagination
    pagination: {
        defaultLimit: 20,
        maxLimit: 100,
    },

    // File upload
    upload: {
        maxFileSize: parseInt(process.env.MAX_FILE_SIZE ?? String(5 * 1024 * 1024), 10),
        allowedTypes: ['image/jpeg', 'image/png', 'image/webp', 'image/gif'],
    },

    // Rate limiting
    rateLimit: {
        general: {
            windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS ?? '60000', 10),
            max: parseInt(process.env.RATE_LIMIT_MAX ?? '100', 10),
        },
        auth: {
            windowMs: parseInt(process.env.RATE_LIMIT_AUTH_WINDOW_MS ?? '60000', 10),
            max: parseInt(process.env.RATE_LIMIT_AUTH_MAX ?? '10', 10),
        },
        // OTP endpoints are high-value targets for brute-force and spam.
        // 5 requests per 15 minutes per IP — stricter than general auth.
        // Covers: verify-otp, verify-login-otp, reset-password, resend-otp.
        otp: {
            windowMs: parseInt(process.env.RATE_LIMIT_OTP_WINDOW_MS ?? '900000', 10), // 15 min
            max:      parseInt(process.env.RATE_LIMIT_OTP_MAX      ?? '5',      10),
        },
    },

    // AI Features & Observability
    ai: {
        enableAnalytics: process.env.ENABLE_AI_ANALYTICS === 'true',
        intents: {
            spending_summary: process.env.ENABLE_AI_INTENT_SPENDING !== 'false',
            health_score: process.env.ENABLE_AI_INTENT_HEALTH !== 'false',
            prediction: process.env.ENABLE_AI_INTENT_PREDICTION !== 'false',
            subscriptions: process.env.ENABLE_AI_INTENT_SUBSCRIPTIONS !== 'false',
        }
    },
});

export default constants;

export const LIMITS = {
  GLOBAL_CONCURRENCY: 100,
  ANALYTICS_CONCURRENCY: 3,
  ANALYTICS_PER_USER: 1
};

export const ACTIVE_TRANSACTION_FILTER = {
    isDeleted: false
};
