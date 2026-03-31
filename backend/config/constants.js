if (!process.env.JWT_SECRET) {
    throw new Error('FATAL: JWT_SECRET environment variable is not set. Refusing to start with no signing key.');
}

export default {
    jwtSecret: process.env.JWT_SECRET,
    jwtExpire: process.env.JWT_EXPIRE || '7d',
    port: process.env.PORT || 5000,
    frontendUrl: process.env.FRONTEND_URL || 'http://localhost:5173',
    bcryptSaltRounds: 12,
    pagination: {
        defaultLimit: 20,
        maxLimit: 100,
    },
    upload: {
        maxFileSize: 5 * 1024 * 1024, // 5MB
        allowedTypes: ['image/jpeg', 'image/png', 'image/webp', 'image/gif'],
    },
    rateLimit: {
        general: { windowMs: 60000, max: 100 },
        auth: { windowMs: 60000, max: 10 },
    },
};
