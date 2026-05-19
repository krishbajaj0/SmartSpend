/**
 * @file utils/cache.js
 * @description In-memory bounded Map cache with stale-data fallback support.
 */

const MAX_KEYS = 500;
const TTL_MS = 60_000; // 60 seconds

const cache = new Map();

/**
 * Get an item from the cache.
 * Returns { data, isStale } if found, or null if missing.
 */
export function getCache(key) {
    const entry = cache.get(key);
    if (!entry) return null;
    return {
        data: entry.data,
        isStale: Date.now() > entry.expiresAt
    };
}

/**
 * Set an item in the cache. Evicts oldest if at capacity.
 */
export function setCache(key, data, ttlSeconds = TTL_MS / 1000) {
    if (cache.size >= MAX_KEYS) {
        // Map iterates in insertion order, so the first key is the oldest
        const oldestKey = cache.keys().next().value;
        cache.delete(oldestKey);
    }
    // Set or overwrite
    cache.set(key, {
        data,
        expiresAt: Date.now() + (ttlSeconds * 1000)
    });
}

/**
 * Invalidate all keys matching a prefix.
 * e.g., invalidatePrefix('analytics_user123_')
 */
export function invalidatePrefix(prefix) {
    for (const key of cache.keys()) {
        if (key.startsWith(prefix)) {
            cache.delete(key);
        }
    }
}

export function invalidateUserDerivedCache(userId) {
    if (!userId) return;
    const id = String(userId);
    for (const key of cache.keys()) {
        if (key.includes(id)) {
            cache.delete(key);
        }
    }
}

