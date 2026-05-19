import ControlFlag from '../models/ControlFlag.js';
import ControlDecisionLog from '../models/ControlDecisionLog.js';
import logger from '../config/logger.js';

const UNSAFE = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);
const CACHE_TTL_MS = 5_000;
let cached = { expiresAt: 0, flags: [] };

function featureForPath(path) {
    if (path.startsWith('/api/analytics')) return 'analytics';
    if (path.startsWith('/api/import')) return 'imports';
    if (path.startsWith('/api/receipts')) return 'receipts';
    if (path.startsWith('/api/ai')) return 'ai';
    if (path.startsWith('/api/budgets')) return 'budgets';
    if (path.startsWith('/api/expenses')) return 'expenses';
    if (path.startsWith('/api/auth')) return 'auth';
    return 'api';
}

async function loadFlags() {
    const now = Date.now();
    if (cached.expiresAt > now) return cached.flags;
    const flags = await ControlFlag.find({
        $or: [{ expiresAt: null }, { expiresAt: { $gt: new Date() } }],
    }).lean();
    cached = { expiresAt: now + CACHE_TTL_MS, flags };
    return flags;
}

function findFlag(flags, key, feature, userId) {
    return flags.find(flag => flag.key === key && flag.scopeType === 'user' && flag.scopeId === userId)
        || flags.find(flag => flag.key === key && flag.scopeType === 'feature' && flag.scopeId === feature)
        || flags.find(flag => flag.key === key && flag.scopeType === 'global');
}

async function logDecision(req, res, flag, action) {
    res.locals.featureFlagVersion = flag.version;
    const payload = {
        requestId: req.requestId,
        userId: req.user?._id,
        key: flag.key,
        scopeType: flag.scopeType,
        scopeId: flag.scopeId,
        action,
        path: req.originalUrl,
        method: req.method,
        ip: req.ip,
        userAgent: req.get('user-agent'),
        flagVersion: flag.version,
        reason: flag.reason,
    };
    ControlDecisionLog.create(payload).catch(err => logger.error({ err, payload }, 'Control decision log failed'));
}

export async function controlPlane(req, res, next) {
    try {
        const flags = await loadFlags();
        const feature = featureForPath(req.originalUrl.split('?')[0]);
        const userId = req.user?._id?.toString();

        const kill = findFlag(flags, 'GLOBAL_KILL_SWITCH', feature, userId);
        if (kill?.value === true && UNSAFE.has(req.method)) {
            res.locals.rateLimitDecision = 'global_kill_switch';
            await logDecision(req, res, kill, 'block_write');
            return res.status(503).json({ success: false, message: 'Writes are temporarily disabled' });
        }

        const disabled = findFlag(flags, 'DISABLE_FEATURE', feature, userId);
        if (disabled?.value === true) {
            res.locals.degraded = `${feature}:disabled`;
            await logDecision(req, res, disabled, 'disable_feature');
            return res.status(503).json({ success: false, message: `${feature} is temporarily disabled` });
        }

        const readOnly = findFlag(flags, 'READ_ONLY_MODE', feature, userId);
        if (readOnly?.value === true && UNSAFE.has(req.method)) {
            res.locals.degraded = `${feature}:read_only`;
            await logDecision(req, res, readOnly, 'read_only_block');
            return res.status(503).json({ success: false, message: `${feature} is temporarily read-only` });
        }

        const degradation = findFlag(flags, 'DEGRADATION_LEVEL', feature, userId);
        if (degradation?.value) {
            res.locals.degraded = `${feature}:${degradation.value}`;
            res.locals.featureFlagVersion = degradation.version;
            res.setHeader('X-Degraded-Mode', String(degradation.value));
        }

        next();
    } catch (err) {
        logger.error({ err, requestId: req.requestId }, 'Control plane failed open');
        next();
    }
}
