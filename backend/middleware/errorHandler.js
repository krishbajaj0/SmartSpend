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

    // JWT errors
    if (err.name === 'JsonWebTokenError') {
        statusCode = 401;
        message = 'Invalid token';
    }
    if (err.name === 'TokenExpiredError') {
        statusCode = 401;
        message = 'Token expired';
    }

    console.error(`[ERROR] ${statusCode} - ${message}${err.stack ? '\n' + err.stack : ''}`);

    res.status(statusCode).json({
        success: false,
        message,
        ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
    });
}
