import AuditLog from '../models/AuditLog.js';
import logger from '../config/logger.js';

export async function writeAuditLog(req, { entityType, entityId, action, before = null, after = null }) {
    try {
        await AuditLog.create({
            userId: req.user?._id,
            entityType,
            entityId,
            action,
            before,
            after,
            requestId: req.requestId,
            idempotencyKey: req.idempotencyKey,
            ip: req.ip,
            userAgent: req.get('user-agent'),
        });
    } catch (err) {
        logger.error({ err, requestId: req.requestId, entityType, entityId, action }, 'Audit log write failed');
        throw err;
    }
}
