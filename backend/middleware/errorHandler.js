import logger from '../config/logger.js';

/**
 * Custom application error with HTTP status code.
 */
export class AppError extends Error {
    constructor(message, statusCode = 500) {
        super(message);
        this.statusCode = statusCode;
        this.isOperational = true;
        Error.captureStackTrace(this, this.constructor);
    }
}

/**
 * Centralized error-handling middleware.
 */
export function errorHandler(err, req, res, _next) {
    let { statusCode = 500, message } = err;

    // Mongoose validation error
    if (err.name === 'ValidationError') {
        statusCode = 400;
        const messages = Object.values(err.errors).map(e => e.message);
        message = messages.join('. ');
    }

    // Mongoose duplicate key
    if (err.code === 11000) {
        statusCode = 409;
        const field = Object.keys(err.keyValue)[0];
        message = `Duplicate value for ${field}`;
    }

    // Mongoose bad ObjectId
    if (err.name === 'CastError') {
        statusCode = 400;
        message = `Invalid ${err.path}: ${err.value}`;
    }

    // MongoDB query exceeded maxTimeMS — server-side timeout.
    // Return 503 (Service Unavailable) not 500 — this is an overload/capacity
    // issue, not an application bug. Log as warn, not error.
    if (err.code === 50 || err.codeName === 'MaxTimeMSExpired') {
        statusCode = 503;
        message    = 'Database query timed out. Please try again or narrow your request.';
    }

    // JWT errors
    if (err.name === 'JsonWebTokenError') {
        statusCode = 401;
        message = 'Invalid token';
    }
    if (err.name === 'TokenExpiredError') {
        statusCode = 401;
        message = 'Token expired';
    }

    // Route 5xx through logger.error, 4xx through logger.warn.
    // Exception: DB timeouts (code 50) are a capacity/infrastructure issue —
    // log as WARN to avoid alert fatigue from log-based 5xx monitors.
    const isDbTimeout = err.code === 50 || err.codeName === 'MaxTimeMSExpired';
    const logFn = (statusCode >= 500 && !isDbTimeout) ? logger.error : logger.warn;
    logFn({ err, statusCode, url: req.originalUrl, method: req.method }, message);

    res.status(statusCode).json({
        success: false,
        message,
        // Forward structured OTP metadata so the frontend can update UI state directly
        ...(err.attemptsRemaining !== undefined && { attemptsRemaining: err.attemptsRemaining }),
        ...(err.secondsLeft      !== undefined && { secondsLeft:       err.secondsLeft      }),
        ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
    });
}
