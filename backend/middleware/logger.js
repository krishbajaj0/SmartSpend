/**
 * @file middleware/logger.js
 * @description HTTP request logging + metrics instrumentation middleware.
 *
 * On every response 'finish' event this middleware:
 *  1. Logs the request (method, path, status, duration) via the structured logger
 *  2. Records the request into the in-process metrics store (utils/metrics.js)
 *
 * The metrics store is updated here — not in individual controllers — so every
 * request is counted exactly once regardless of which route handled it.
 *
 * ROUTE NORMALISATION
 * ───────────────────
 * req.route?.path contains the Express route pattern (e.g. "/:id") but not
 * the mount prefix. We use req.baseUrl + req.route.path to get the full pattern
 * (e.g. "/api/expenses/:id"). This prevents high-cardinality keys in the metrics
 * map from per-request path values like "/api/expenses/507f1f77bcf86cd799439011".
 * Falls back to req.originalUrl if the route isn't resolved (e.g. 404s).
 */

import crypto from 'crypto';
import logger from '../config/logger.js';
import { recordRequest } from '../utils/metrics.js';
import { recordOperationalSignal } from '../utils/automatedDefense.js';

/**
 * Logs method, path, status code, and response time for every HTTP request.
 * Also feeds the in-process metrics store.
 */
export function requestLogger(req, res, next) {
    const start = process.hrtime.bigint(); // nanosecond precision
    req.requestId = req.headers['x-request-id'] || crypto.randomUUID();
    res.setHeader('X-Request-Id', req.requestId);

    res.on('finish', () => {
        const durationMs = Number(process.hrtime.bigint() - start) / 1_000_000;
        const status     = res.statusCode;
        const { method, originalUrl } = req;

        // Normalise to route pattern — avoids high-cardinality metric keys.
        // req.route is set by Express after the handler runs.
        const routePattern = req.route
            ? (req.baseUrl || '') + req.route.path
            : originalUrl.split('?')[0]; // strip query string from unmatched paths

        // ── Structured log ────────────────────────────────────────────────────
        let logFn;
        if (status >= 500 || durationMs > 3000) {
            logFn = logger.error;
        } else if (status >= 400 || durationMs > 1000) {
            logFn = logger.warn;
        } else {
            logFn = logger.info;
        }

        const activeRequests = req.app.locals.activeRequests;
        let reason = res.locals.degraded ? 'degraded' : undefined;
        if (status === 503) reason = 'overload';

        logFn({
            requestId: req.requestId,
            userId: req.user?._id?.toString(),
            method,
            url: originalUrl,
            route: routePattern,
            status,
            durationMs: Math.round(durationMs),
            activeRequests,
            idempotencyKey: req.idempotencyKey,
            degradedMode: res.locals.degraded,
            rateLimitDecision: res.locals.rateLimitDecision,
            featureFlagVersion: res.locals.featureFlagVersion,
            ip: req.ip,
            userAgent: req.get('user-agent'),
            reason
        }, `${method} ${originalUrl} → ${status} (${Math.round(durationMs)}ms)`);

        // ── Metrics recording ─────────────────────────────────────────────────
        recordRequest(method, routePattern, status, Math.round(durationMs));
        recordOperationalSignal({ route: routePattern, status, durationMs: Math.round(durationMs) });
    });

    next();
}

