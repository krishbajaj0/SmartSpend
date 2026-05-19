import os from 'os';
import JobLock from '../models/JobLock.js';
import logger from '../config/logger.js';

const OWNER = `${os.hostname()}-${process.pid}`;

export async function runWithJobLock(key, fn, ttlMs = 30 * 60 * 1000) {
    const now = new Date();
    const lockedUntil = new Date(now.getTime() + ttlMs);
    const lock = await JobLock.findOneAndUpdate(
        { key, $or: [{ lockedUntil: { $lte: now } }, { owner: OWNER }] },
        { $set: { owner: OWNER, lockedUntil, lastStartedAt: now }, $unset: { lastError: 1 } },
        { upsert: true, new: true }
    );

    if (!lock || lock.owner !== OWNER) {
        logger.info({ key }, 'Job skipped because another worker holds the lock');
        return null;
    }

    try {
        const result = await fn();
        await JobLock.updateOne(
            { key, owner: OWNER },
            { $set: { lastCompletedAt: new Date(), lockedUntil: new Date() } }
        );
        return result;
    } catch (err) {
        await JobLock.updateOne(
            { key, owner: OWNER },
            { $set: { lastError: err.message, lockedUntil: new Date() } }
        );
        throw err;
    }
}
