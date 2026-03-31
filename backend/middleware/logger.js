/**
 * Request logging middleware — logs method, path, status, and response time.
 */
export function requestLogger(req, res, next) {
    const start = Date.now();
    const { method, originalUrl } = req;

    res.on('finish', () => {
        const duration = Date.now() - start;
        const status = res.statusCode;
        const color = status >= 500 ? '🔴' : status >= 400 ? '🟡' : '🟢';
        console.log(`${color} ${method} ${originalUrl} → ${status} (${duration}ms)`);
    });

    next();
}
