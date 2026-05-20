import logger from '../config/logger.js';

/**
 * Send JSON response safely, guarding against double-response header issues.
 * @param {import('express').Response} res
 * @param {number} status
 * @param {any} payload
 * @returns {import('express').Response | void}
 */
export function safeJson(res, status, payload) {
    if (res.headersSent) {
        logger.warn({ status, payload }, 'Attempted to send response after headers were already sent.');
        return;
    }
    return res.status(status).json(payload);
}
