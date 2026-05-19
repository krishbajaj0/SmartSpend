/**
 * @file server.js
 * @description Application entry point and startup bootstrap.
 *
 * Startup sequence (ORDER MATTERS):
 *  1. Load env vars (dotenv) — must be first so every subsequent import sees them.
 *  2. Import constants — validates and throws if required vars are absent.
 *  3. Connect to MongoDB — server does NOT start until DB is ready.
 *  4. Build Express app and attach middleware.
 *  5. Initialise Socket.io on the HTTP server.
 *  6. Start the HTTP server.
 *  7. Start cron jobs (after server is up, so they can use the HTTP client if needed).
 *
 * Graceful shutdown (ORDER MATTERS):
 *  1. Stop accepting new connections (server.close).
 *  2. Close the MongoDB connection (flush in-flight writes).
 *  3. Exit with code 0.
 *
 * Why crash-hard on unhandledRejection / uncaughtException?
 *  Silently swallowing these errors leaves the process in an undefined state.
 *  It is safer to crash fast and let the process manager (PM2, Railway, Render,
 *  Docker restart policy) bring the service back from a known-clean state.
 */

import 'dotenv/config';

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import rateLimit from 'express-rate-limit';
import http from 'http';

import logger from './config/logger.js';
import connectDB, { disconnectDB, getConnectionState } from './config/db.js';
import constants from './config/constants.js';
import { errorHandler } from './middleware/errorHandler.js';
import { requestLogger } from './middleware/logger.js';
import { requestTimeout } from './middleware/requestTimeout.js';
import { createConcurrencyLimiter, analyticsUserLimiter } from './middleware/backpressure.js';
import { csrfProtection } from './middleware/csrf.js';
import { controlPlane } from './middleware/controlPlane.js';
import { protect } from './middleware/auth.js';
import { LIMITS } from './config/constants.js';
import { getMetrics } from './utils/metrics.js';
import { AUTH_COOKIE } from './utils/authCookies.js';

// ── Route imports ─────────────────────────────────────────────────────────────
import authRoutes        from './routes/auth.js';
import expenseRoutes     from './routes/expenses.js';
import budgetRoutes      from './routes/budgets.js';
import goalRoutes        from './routes/goals.js';
import receiptRoutes     from './routes/receipts.js';
import analyticsRoutes   from './routes/analytics.js';
import notificationRoutes from './routes/notifications.js';
import aiRoutes          from './routes/ai.js';
import importRoutes      from './routes/import.js';
import dashboardRoutes   from './routes/dashboard.js';
import accountRoutes     from './routes/accounts.js';
import transactionRoutes from './routes/transactions.js';
import { initSocket }    from './services/socketService.js';

// ── Process-level safety nets ─────────────────────────────────────────────────
// These MUST be registered before any async work begins.
process.on('uncaughtException', (err) => {
    logger.fatal({ err }, 'Uncaught exception — crashing to prevent undefined state.');
    // Give the logger a tick to flush before exiting.
    setImmediate(() => process.exit(1));
});

process.on('unhandledRejection', (reason) => {
    logger.fatal({ err: reason instanceof Error ? reason : new Error(String(reason)) },
        'Unhandled promise rejection — crashing to prevent undefined state.');
    setImmediate(() => process.exit(1));
});

// ── Build Express app ─────────────────────────────────────────────────────────
const app = express();
const server = http.createServer(app);

// ── Security & parsing ────────────────────────────────────────────────────────
app.use(helmet());
app.use(compression());

app.use(cors({
    origin(origin, callback) {
        // Allow requests with no origin (curl, Postman, mobile apps, server-to-server)
        if (!origin) return callback(null, true);

        const ALLOWED_ORIGINS = [
            constants.frontendUrl,
            'http://localhost:5173',
            'http://localhost:4173',
            'http://127.0.0.1:5173',
        ];

        const isLocalNetwork = /^https?:\/\/(localhost|127\.0\.0\.1|192\.168\.\d+\.\d+)(:\d+)?$/.test(origin);

        if (ALLOWED_ORIGINS.includes(origin) || isLocalNetwork) {
            return callback(null, true);
        }
        return callback(new Error(`CORS: origin '${origin}' not allowed.`));
    },
    credentials: true,
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(csrfProtection);

// ── Logging ───────────────────────────────────────────────────────────────────
app.use(requestLogger);
app.use('/api', controlPlane);

// ── Request timeout ───────────────────────────────────────────────────────────
// Every API request has a hard ceiling. Handlers that take longer get a 503.
// Configurable via REQUEST_TIMEOUT_MS env var (default 30 s).
const REQUEST_TIMEOUT_MS = parseInt(process.env.REQUEST_TIMEOUT_MS ?? '30000', 10);
app.use(requestTimeout(REQUEST_TIMEOUT_MS));

// ── Rate limiting ─────────────────────────────────────────────────────────────
// TWO TIERS:
//   generalLimiter (100 req/min) — public routes, no auth required
//   apiLimiter     (300 req/min) — authenticated API routes
//
// WHY SEPARATE?
//   A single 100/min limit blocks legitimate burst traffic from the frontend:
//   a dashboard page load fires 6+ parallel requests simultaneously, burning
//   6% of the per-minute budget in a single interaction. Authenticated users
//   are identified and accountable; 300/min (5 req/s) is a generous but safe
//   limit that stops runaway clients without triggering on normal usage.
const generalLimiter = rateLimit({
    windowMs: constants.rateLimit.general.windowMs,
    max:      constants.rateLimit.general.max,          // 100/min — public
    standardHeaders: true,
    legacyHeaders:   false,
    // Authenticated requests are handled by apiLimiter (300/min) — skip here
    // so they aren't double-counted against the stricter public budget.
    skip: (req) => !!req.headers.authorization || req.headers.cookie?.includes(`${AUTH_COOKIE}=`),
    message: { success: false, message: 'Too many requests. Please try again later.' },
});

// Authenticated route limiter — 3x headroom for burst-heavy dashboard traffic.
// Applied only to /api/* routes that sit behind the protect() middleware.
const apiLimiter = rateLimit({
    windowMs: constants.rateLimit.general.windowMs,
    max:      Math.max(constants.rateLimit.general.max * 3, 300), // 300/min minimum
    keyGenerator: (req) => req.user?._id?.toString() || 'authenticated-route',
    standardHeaders: true,
    legacyHeaders:   false,
    message: { success: false, message: 'Too many requests. Please try again later.' },
});
app.use('/api', generalLimiter);

// Auth routes use their own authLimiter + otpLimiter (defined in routes/auth.js).
// All data routes use apiLimiter (300/min for authenticated users).

// 1. Analytics limiter FIRST (protect global capacity)
app.use(
  '/api/analytics',
  protect,
  controlPlane,
  createConcurrencyLimiter(LIMITS.ANALYTICS_CONCURRENCY, 'analytics'),
  analyticsUserLimiter(LIMITS.ANALYTICS_PER_USER),
  apiLimiter,
  analyticsRoutes
);

// 2. Global limiter AFTER
app.use(createConcurrencyLimiter(LIMITS.GLOBAL_CONCURRENCY, 'global'));

// 3. Critical CRUD and Auth routes (HIGH priority)
app.use('/api/auth',          authRoutes);
app.use('/api/expenses',      protect, controlPlane, apiLimiter, expenseRoutes);
app.use('/api/budgets',       protect, controlPlane, apiLimiter, budgetRoutes);
app.use('/api/goals',         protect, controlPlane, apiLimiter, goalRoutes);
app.use('/api/receipts',      protect, controlPlane, apiLimiter, receiptRoutes);
app.use('/api/notifications', protect, controlPlane, apiLimiter, notificationRoutes);
app.use('/api/ai',            protect, controlPlane, apiLimiter, aiRoutes);
app.use('/api/import',        protect, controlPlane, apiLimiter, importRoutes);
app.use('/api/dashboard',     protect, controlPlane, apiLimiter, dashboardRoutes);
app.use('/api/accounts',      protect, controlPlane, apiLimiter, accountRoutes);
app.use('/api/transactions',  protect, controlPlane, apiLimiter, transactionRoutes);

// ── Health check ──────────────────────────────────────────────────────────────
// Returns DB connection state so load balancers / uptime monitors can detect
// a degraded-but-running instance and route traffic away if needed.
app.get('/api/health', (_req, res) => {
    const dbState = getConnectionState();
    const healthy = dbState === 'connected';
    res.status(healthy ? 200 : 503).json({
        success: healthy,
        message: healthy ? 'SmartSpend API is healthy' : 'Service degraded',
        timestamp: new Date().toISOString(),
        db: dbState,
        env: constants.nodeEnv,
    });
});

// ── Metrics endpoint ──────────────────────────────────────────────────────────
// JWT-secured. Use any valid user token to access.
// Returns request counts, error rates, and latency percentiles (p50/p95/p99).
app.get('/api/metrics', protect, (_req, res) => {
    res.json({ success: true, metrics: getMetrics() });
});

if (!constants.isProduction) {
    app.get('/api/debug/smtp', (_req, res) => {
        const configured = !!(process.env.SMTP_USER && process.env.SMTP_PASS);
        res.json({
            configured,
            user: process.env.SMTP_USER || null,
            message: configured
                ? 'SMTP is configured'
                : 'SMTP not configured. OTP delivery is disabled unless NODE_ENV=test and ALLOW_DEBUG_OTP=true.',
        });
    });
}

// ── Centralised error handling ────────────────────────────────────────────────
app.use(errorHandler);

// ── Graceful shutdown ─────────────────────────────────────────────────────────
let isShuttingDown = false;

async function gracefulShutdown(signal) {
    if (isShuttingDown) return;
    isShuttingDown = true;

    logger.info(`${signal} received. Starting graceful shutdown…`);

    // 1. Stop accepting new connections. Existing connections are drained.
    server.close(async () => {
        logger.info('HTTP server closed. No new connections accepted.');

        // 2. Close DB connection after HTTP is fully drained (no in-flight queries).
        await disconnectDB();

        logger.info('Shutdown complete. Exiting.');
        process.exit(0);
    });

    // Safety net: force-exit after 15 s if draining takes too long.
    // This prevents the process from hanging in a zombie state indefinitely.
    setTimeout(() => {
        logger.error('Graceful shutdown timed out after 15 s. Forcing exit.');
        process.exit(1);
    }, 15_000).unref(); // .unref() so the timer doesn't keep the event loop alive
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM')); // Docker / Kubernetes stop
process.on('SIGINT',  () => gracefulShutdown('SIGINT'));  // Ctrl-C / dev mode

// ── Bootstrap (DB first, then HTTP) ──────────────────────────────────────────
(async () => {
    // Connect to MongoDB. connectDB() exits the process on failure, so if we
    // reach the next line we are guaranteed to have a live DB connection.
    await connectDB();

    // Attach Socket.io AFTER confirming the DB is live (sockets may emit DB events).
    initSocket(server);

    const PORT = constants.port;
    server.listen(PORT, () => {
        logger.info(`🚀 SmartSpend API listening on port ${PORT} [${constants.nodeEnv}]`);
        logger.info(`📧 SMTP: ${process.env.SMTP_USER ? process.env.SMTP_USER : 'Not configured (mock mode)'}`);
        logger.info('Background jobs are disabled in the API process. Run npm run worker separately.');
    });
})();

export default app;



