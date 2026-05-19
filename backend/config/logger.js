/**
 * @file config/logger.js
 * @description Structured, levelled logger for production use.
 *
 * Why not console.log?
 *  - console.log has no log levels → you can't filter noise in production.
 *  - console.log is synchronous in some environments → can block the event loop.
 *  - Structured JSON logs (level, timestamp, message, context) are parseable by
 *    every modern log aggregator (Datadog, Loki, CloudWatch, Railway logs).
 *
 * This implementation provides a lightweight structured logger without requiring
 * an external dependency like pino or winston. If the project grows, swap the
 * internals for pino (fastest Node logger) while keeping the same API surface.
 *
 * Log levels (ascending severity): debug < info < warn < error < fatal
 * Set LOG_LEVEL env var to control verbosity. Default: 'info' in production,
 * 'debug' in development.
 */

const LEVELS = { debug: 0, info: 1, warn: 2, error: 3, fatal: 4 };

const ENV_LEVEL = (process.env.LOG_LEVEL ?? (process.env.NODE_ENV === 'production' ? 'info' : 'debug')).toLowerCase();
const ACTIVE_LEVEL = LEVELS[ENV_LEVEL] ?? LEVELS.info;

const isDev = process.env.NODE_ENV !== 'production';

/**
 * Formats a log entry.
 * - Development: human-readable with emoji prefixes for fast scanning.
 * - Production: single-line JSON for log aggregators.
 */
function formatEntry(level, context, message) {
    const ts = new Date().toISOString();

    if (isDev) {
        const prefixes = { debug: '🔵', info: '🟢', warn: '🟡', error: '🔴', fatal: '💀' };
        const prefix = prefixes[level] ?? '⚪';
        const contextStr = context && Object.keys(context).length
            ? `\n  ${JSON.stringify(context, null, 2).replace(/\n/g, '\n  ')}`
            : '';
        return `${prefix} [${ts}] ${level.toUpperCase().padEnd(5)} ${message}${contextStr}`;
    }

    // Production: JSON — each field is top-level for easy parsing
    const entry = { level, ts, msg: message };
    if (context) {
        if (context.err instanceof Error) {
            entry.err = { message: context.err.message, stack: context.err.stack, name: context.err.name };
            const rest = { ...context };
            delete rest.err;
            Object.assign(entry, rest);
        } else {
            Object.assign(entry, context);
        }
    }
    return JSON.stringify(entry);
}

/**
 * Creates a log function for the given level.
 * Signature: logger.info(message) or logger.info(contextObject, message)
 */
function createLogFn(level) {
    return function (...args) {
        if (LEVELS[level] < ACTIVE_LEVEL) return;

        let context = null;
        let message = '';

        if (args.length === 1) {
            message = String(args[0]);
        } else if (args.length >= 2 && typeof args[0] === 'object' && args[0] !== null) {
            context = args[0];
            message = String(args[1]);
        } else {
            message = args.map(String).join(' ');
        }

        const entry = formatEntry(level, context, message);
        const output = level === 'error' || level === 'fatal' ? process.stderr : process.stdout;
        output.write(entry + '\n');
    };
}

const logger = {
    debug: createLogFn('debug'),
    info:  createLogFn('info'),
    warn:  createLogFn('warn'),
    error: createLogFn('error'),
    fatal: createLogFn('fatal'),
};

export default logger;
