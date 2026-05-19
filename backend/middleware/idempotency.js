import crypto from 'crypto';
import fs from 'fs';
import IdempotencyKey from '../models/IdempotencyKey.js';
import { AppError } from './errorHandler.js';

const METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);
const PROTECTED_PREFIXES = ['/api/expenses', '/api/import', '/api/receipts', '/api/budgets'];
const TTL_MS = 24 * 60 * 60 * 1000;

function shouldApply(req) {
    return METHODS.has(req.method) && PROTECTED_PREFIXES.some(prefix => req.originalUrl.startsWith(prefix));
}

function hashRequest(req) {
    let fileHash = null;
    if (req.file?.buffer) {
        fileHash = crypto.createHash('sha256').update(req.file.buffer).digest('hex');
    } else if (req.file?.path && fs.existsSync(req.file.path)) {
        fileHash = crypto.createHash('sha256').update(fs.readFileSync(req.file.path)).digest('hex');
    }

    const file = req.file ? {
        fieldname: req.file.fieldname,
        originalname: req.file.originalname,
        size: req.file.size,
        sha256: fileHash,
    } : null;

    return crypto
        .createHash('sha256')
        .update(JSON.stringify({
            method: req.method,
            path: req.originalUrl.split('?')[0],
            body: req.body || {},
            query: req.query || {},
            file,
        }))
        .digest('hex');
}

function cleanupUploadedFile(req) {
    if (req.file?.path && fs.existsSync(req.file.path)) {
        fs.unlink(req.file.path, () => {});
    }
}

export async function idempotency(req, res, next) {
    if (!shouldApply(req)) return next();
    if (!req.user?._id) return next(new AppError('Authentication required before idempotency check', 500));

    const key = req.headers['idempotency-key'];
    if (!key || typeof key !== 'string' || key.length < 16 || key.length > 128) {
        return next(new AppError('Idempotency-Key header is required for this write', 400));
    }

    const route = req.baseUrl || req.path;
    const requestHash = hashRequest(req);
    const filter = { userId: req.user._id, route, method: req.method, key };

    try {
        const existing = await IdempotencyKey.findOne(filter);
        if (existing) {
            if (existing.requestHash !== requestHash) {
                cleanupUploadedFile(req);
                return next(new AppError('Idempotency key conflict', 409));
            }
            req.idempotencyKey = key;
            if (!existing.completed) {
                cleanupUploadedFile(req);
                return next(new AppError('Request with this idempotency key is already in progress', 409));
            }
            cleanupUploadedFile(req);
            return res.status(existing.statusCode || 200).json(existing.responseBody);
        } else {
            try {
                await IdempotencyKey.create({
                    ...filter,
                    requestHash,
                    expiresAt: new Date(Date.now() + TTL_MS),
                });
            } catch (err) {
                if (err?.code === 11000) {
                    return next(new AppError('Request with this idempotency key is already in progress', 409));
                }
                throw err;
            }
            req.idempotencyKey = key;
        }

        const originalJson = res.json.bind(res);
        res.json = (body) => {
            const responseHash = crypto.createHash('sha256').update(JSON.stringify(body ?? null)).digest('hex');
            IdempotencyKey.findOneAndUpdate(filter, {
                statusCode: res.statusCode,
                responseHash,
                responseBody: body,
                completed: true,
            }).catch(() => {});
            return originalJson(body);
        };

        next();
    } catch (err) {
        next(err);
    }
}
