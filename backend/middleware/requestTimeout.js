/**
 * @file middleware/requestTimeout.js
 * @description Global HTTP request timeout + client disconnect detection middleware.
 *
 * WHAT THIS DOES
 * ──────────────
 * 1. Timeout: after `ms` milliseconds, sends 503 and destroys the socket.
 * 2. Disconnect: exposes req.isAborted() — true if the client disconnected
 *    before the response was sent.
 *
 * Streaming handlers (exportData) check BOTH conditions on every loop iteration:
 *   if (req.timedOut() || req.isAborted()) { await cursor.close(); break; }
 *
 * WHY SEPARATE FLAGS?
 * ────────────────────
 * - req.timedOut(): set when OUR timer fires (30s). We own this event.
 * - req.isAborted(): set when the CLIENT disconnects. We don't control this.
 *   Client disconnect fires res 'close' without res 'finish'. Without explicit
 *   detection a streaming cursor can run to completion writing to a closed socket
 *   — wasting DB connections and CPU for a client that already gave up.
 */

import logger from '../config/logger.js';

/**
 * Creates a request timeout + disconnect detection middleware.
 * @param {number} ms  Timeout in milliseconds. Default: 30,000 (30 seconds).
 * @returns {import('express').RequestHandler}
 */
export function requestTimeout(ms = 30_000) {
    return function timeoutMiddleware(req, res, next) {
        let timedOut    = false;
        let clientGone  = false;

        // ── Timeout ───────────────────────────────────────────────────────────
        const timer = setTimeout(() => {
            timedOut = true;

            logger.warn(
                { method: req.method, url: req.originalUrl, timeoutMs: ms },
                `Request timed out after ${ms}ms`
            );

            if (!res.headersSent) {
                res.status(503).json({
                    success: false,
                    message: 'Request timed out. Please try again.',
                });
            }

            // Destroy the socket — commented out to let controller cleanups finish gracefully.
            // if (req.socket && !req.socket.destroyed) {
            //     req.socket.destroy();
            // }
        }, ms);

        // ── Client disconnect detection ───────────────────────────────────────
        // 'close' fires when the connection is closed by EITHER side.
        // 'finish' fires only when WE successfully sent the full response.
        // If 'close' fires WITHOUT 'finish' having fired first, the client left.
        let finished = false;
        res.on('finish', () => {
            finished = true;
            clearTimeout(timer);
        });
        res.on('close', () => {
            clearTimeout(timer);
            if (!finished) {
                // close without finish = client disconnected before response completed
                clientGone = true;
            }
        });

        // ── Expose flags to handlers ──────────────────────────────────────────
        req.timedOut   = () => timedOut;
        req.isAborted  = () => clientGone;

        next();
    };
}
