/**
 * @file utils/metrics.js
 * @description Lightweight Prometheus-style in-process metrics store.
 *
 * WHY NOT USE prom-client?
 * ────────────────────────
 * prom-client is excellent but adds ~400 KB to the bundle and requires a
 * separate scrape setup. For a single-instance Node app, this hand-rolled
 * implementation gives us the same visibility with zero external dependencies:
 *  - Request counts by method + route pattern + status
 *  - Error counts
 *  - Response time histogram (p50, p95, p99) using a fixed-bucket HDR approach
 *
 * If you later need Prometheus scraping (Grafana, alerting), swap this module
 * for prom-client and update the /api/metrics endpoint to call register.metrics().
 *
 * DESIGN
 * ──────
 * All state is module-level (singleton per process). Metrics are append-only
 * counters and sorted arrays — no locks needed because Node.js is single-threaded.
 * Memory is bounded: durations array is capped at MAX_DURATIONS entries.
 */

const MAX_DURATIONS = 10_000; // rolling window — older samples evicted

/** @type {Map<string, number>} key: "METHOD route_pattern status" */
const requestCounts = new Map();

/** @type {Map<string, number>} key: "METHOD route_pattern status" */
const errorCounts   = new Map();

/** @type {number[]} Response times in ms (rolling window) */
let durations = [];

// ── Recording ─────────────────────────────────────────────────────────────────

/**
 * Record one completed request.
 * @param {string} method      HTTP method (GET, POST, …)
 * @param {string} route       Normalised route pattern (e.g. /api/expenses/:id)
 * @param {number} statusCode  HTTP response status
 * @param {number} durationMs  Response time in ms
 */
export function recordRequest(method, route, statusCode, durationMs) {
    const key = `${method} ${route} ${statusCode}`;
    requestCounts.set(key, (requestCounts.get(key) ?? 0) + 1);

    if (statusCode >= 400) {
        errorCounts.set(key, (errorCounts.get(key) ?? 0) + 1);
    }

    // Evict oldest entry when the cap is hit (O(1) amortised — splice only runs
    // once every MAX_DURATIONS requests which is rare).
    if (durations.length >= MAX_DURATIONS) {
        durations.splice(0, Math.floor(MAX_DURATIONS / 10)); // evict oldest 10%
    }
    durations.push(durationMs);
}

// ── Percentile calculation ────────────────────────────────────────────────────

/**
 * Calculate a percentile from the rolling duration window.
 * @param {number} p  Percentile (0–100)
 * @returns {number} Duration in ms, or 0 if no data
 */
function percentile(p) {
    if (durations.length === 0) return 0;
    const sorted = [...durations].sort((a, b) => a - b);
    const idx    = Math.ceil((p / 100) * sorted.length) - 1;
    return sorted[Math.max(0, idx)];
}

// ── Snapshot ──────────────────────────────────────────────────────────────────

/**
 * Return a complete snapshot of all metrics.
 * Called by the /api/metrics endpoint.
 */
export function getMetrics() {
    const totalRequests = [...requestCounts.values()].reduce((s, v) => s + v, 0);
    const totalErrors   = [...errorCounts.values()].reduce((s, v)   => s + v, 0);

    return {
        uptime:          process.uptime(),
        memoryMb:        (process.memoryUsage().rss / 1024 / 1024).toFixed(1),
        totalRequests,
        totalErrors,
        errorRate:       totalRequests > 0
            ? ((totalErrors / totalRequests) * 100).toFixed(2) + '%'
            : '0.00%',
        latency: {
            p50: percentile(50),
            p95: percentile(95),
            p99: percentile(99),
            sampleSize: durations.length,
        },
        requestsByRoute: Object.fromEntries(requestCounts),
        errorsByRoute:   Object.fromEntries(errorCounts),
    };
}

/** Reset all metrics — useful for testing. */
export function resetMetrics() {
    requestCounts.clear();
    errorCounts.clear();
    durations = [];
}
