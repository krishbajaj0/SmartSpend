/**
 * @file controllers/aiChatController.js
 *
 * Thin controller for the AI Chat Assistant.
 * Validates input, sanitizes, calls orchestrator, persists messages, returns response.
 *
 * Security:
 *   - Input sanitized via sanitize-html (strip all tags)
 *   - Max 500 chars enforced
 *   - conversationState validated as plain object
 *   - No raw DB access — everything goes through the orchestrator
 */

import sanitizeHtml from 'sanitize-html';
import { orchestrate } from '../services/ai/chat/orchestrator.js';
import ChatMessage from '../models/ChatMessage.js';
import logger from '../config/logger.js';
import crypto from 'crypto';

/**
 * POST /api/ai/chat
 * Body: { message: string, conversationState?: object, sessionId?: string }
 */
export async function handleChatMessage(req, res, next) {
    try {
        const { message, conversationState, sessionId } = req.body;

        // ── Sanitize message ──
        const cleanMessage = sanitizeHtml(message, {
            allowedTags: [],
            allowedAttributes: {},
        }).trim();

        if (!cleanMessage || cleanMessage.length === 0) {
            return res.status(400).json({ success: false, message: 'Message is required' });
        }
        if (cleanMessage.length > 500) {
            return res.status(400).json({ success: false, message: 'Message must be under 500 characters' });
        }

        // ── Validate conversationState (prevent injection) ──
        let safeState = null;
        if (conversationState && typeof conversationState === 'object' && !Array.isArray(conversationState)) {
            // Only allow known keys
            safeState = {
                activeIntent: typeof conversationState.activeIntent === 'string' ? conversationState.activeIntent : null,
                activeFilters: conversationState.activeFilters && typeof conversationState.activeFilters === 'object'
                    ? {
                        category: typeof conversationState.activeFilters.category === 'string' ? conversationState.activeFilters.category : null,
                        timeRange: conversationState.activeFilters.timeRange || null,
                        merchant: typeof conversationState.activeFilters.merchant === 'string' ? conversationState.activeFilters.merchant : null,
                    }
                    : null,
                lastResponseType: typeof conversationState.lastResponseType === 'string' ? conversationState.lastResponseType : null,
            };
        }

        // ── Resolve session ID ──
        const resolvedSessionId = (typeof sessionId === 'string' && sessionId.length > 0 && sessionId.length <= 64)
            ? sessionId
            : crypto.randomUUID();

        // ── Orchestrate ──
        const result = await orchestrate(req.user._id, cleanMessage, safeState);

        // ── Persist messages (fire-and-forget — don't block response) ──
        const userId = req.user._id;
        setImmediate(async () => {
            try {
                await ChatMessage.insertMany([
                    {
                        sessionId: resolvedSessionId,
                        userId,
                        role: 'user',
                        message: cleanMessage,
                        conversationState: safeState,
                    },
                    {
                        sessionId: resolvedSessionId,
                        userId,
                        role: 'assistant',
                        message: result.response.text,
                        structuredResponse: result.response,
                        intent: result.meta.intent,
                        intentVersion: result.meta.intentVersion,
                        intentConfidence: result.meta.confidence,
                        conversationState: result.conversationState,
                        responseTimeMs: result.meta.responseTimeMs,
                        aiSource: result.meta.source,
                        errorCode: result.meta.errorCode,
                    },
                ]);
            } catch {
                // Non-critical — don't crash if persistence fails
            }
        });

        // ── Return response ──
        res.json({
            success: true,
            response: result.response,
            conversationState: result.conversationState,
            meta: {
                intent: result.meta.intent,
                confidence: result.meta.confidence,
                responseTimeMs: result.meta.responseTimeMs,
                isFollowUp: result.meta.isFollowUp,
            },
            sessionId: resolvedSessionId,
        });
    } catch (err) {
        next(err);
    }
}

/**
 * GET /api/ai/chat/history?sessionId=xxx
 * Returns chat history for a session (max 50 messages).
 */
export async function getChatHistory(req, res, next) {
    try {
        const { sessionId } = req.query;
        if (!sessionId || typeof sessionId !== 'string') {
            return res.status(400).json({ success: false, message: 'sessionId is required' });
        }

        const messages = await ChatMessage.find({
            sessionId,
            userId: req.user._id,
        })
            .sort({ createdAt: 1 })
            .limit(50)
            .lean();

        res.json({ success: true, messages });
    } catch (err) {
        next(err);
    }
}

/**
 * GET /api/ai/admin-analytics?window=24h|7d|30d
 *
 * Production-grade observability endpoint:
 *   - Intent distribution & volume (bounded by rolling window)
 *   - Latency percentiles (P50/P95/P99)
 *   - Error / fallback rates
 *   - Drift detection with severity levels
 *   - Handler failure counters per intent (lifetime + 24h rate)
 *
 * Query limits: max 90-day range, pipeline limits, allowDiskUse: false
 * Drift alert dedup: 30-minute suppression window
 */

// ── Drift severity thresholds ──
const DRIFT_THRESHOLDS = { low: 15, medium: 25, critical: 40 };

function classifyDriftSeverity(rate) {
    if (rate >= DRIFT_THRESHOLDS.critical) return 'critical';
    if (rate >= DRIFT_THRESHOLDS.medium) return 'medium';
    if (rate >= DRIFT_THRESHOLDS.low) return 'low';
    return 'none';
}

// ── 30-minute alert dedup ──
const _lastDriftAlert = { timestamp: 0, severity: 'none' };
const ALERT_DEDUP_MS = 30 * 60 * 1000; // 30 minutes

function shouldEmitDriftAlert(severity) {
    if (severity === 'none') return false;
    const now = Date.now();
    if (severity === _lastDriftAlert.severity && (now - _lastDriftAlert.timestamp) < ALERT_DEDUP_MS) {
        return false; // suppress duplicate
    }
    _lastDriftAlert.timestamp = now;
    _lastDriftAlert.severity = severity;
    return true;
}

// ── Rolling window resolver ──
const WINDOW_MAP = {
    '24h': 24 * 60 * 60 * 1000,
    '7d': 7 * 24 * 60 * 60 * 1000,
    '30d': 30 * 24 * 60 * 60 * 1000,
};
const MAX_WINDOW_MS = 90 * 24 * 60 * 60 * 1000; // 90 days absolute cap

function resolveWindow(windowParam) {
    const ms = WINDOW_MAP[windowParam] || WINDOW_MAP['7d']; // default 7d
    return new Date(Date.now() - Math.min(ms, MAX_WINDOW_MS));
}

export async function getAdminAnalytics(req, res, next) {
    try {
        const windowParam = req.query.window || '7d';
        const windowStart = resolveWindow(windowParam);
        const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

        const windowMatch = { role: 'assistant', createdAt: { $gte: windowStart } };
        const PIPELINE_LIMIT = 500; // cap result set size

        const [distribution, latency, errors, failuresByIntent, failures24h] = await Promise.all([
            // 1. Intent distribution & volume (bounded)
            ChatMessage.aggregate([
                { $match: windowMatch },
                { $group: { _id: '$intent', count: { $sum: 1 } } },
                { $sort: { count: -1 } },
                { $limit: PIPELINE_LIMIT },
            ]).option({ allowDiskUse: false, maxTimeMS: 3000 }),

            // 2. Latency percentiles (bounded)
            ChatMessage.aggregate([
                { $match: { ...windowMatch, responseTimeMs: { $ne: null } } },
                { $sort: { responseTimeMs: 1 } },
                {
                    $group: {
                        _id: null,
                        latencies: { $push: '$responseTimeMs' },
                        avg: { $avg: '$responseTimeMs' },
                    },
                },
                {
                    $project: {
                        _id: 0,
                        avg: { $round: ['$avg', 0] },
                        p50: { $arrayElemAt: ['$latencies', { $floor: { $multiply: [0.5, { $size: '$latencies' }] } }] },
                        p95: { $arrayElemAt: ['$latencies', { $floor: { $multiply: [0.95, { $size: '$latencies' }] } }] },
                        p99: { $arrayElemAt: ['$latencies', { $floor: { $multiply: [0.99, { $size: '$latencies' }] } }] },
                    },
                },
            ]).option({ allowDiskUse: false, maxTimeMS: 3000 }),

            // 3. Error / fallback rates (bounded)
            ChatMessage.aggregate([
                { $match: { ...windowMatch, errorCode: { $ne: null } } },
                { $group: { _id: '$errorCode', count: { $sum: 1 } } },
                { $limit: PIPELINE_LIMIT },
            ]).option({ allowDiskUse: false, maxTimeMS: 3000 }),

            // 4. Handler failure counters per intent (lifetime within window)
            ChatMessage.aggregate([
                { $match: { ...windowMatch, errorCode: { $ne: null } } },
                {
                    $group: {
                        _id: { intent: '$intent', errorCode: '$errorCode' },
                        count: { $sum: 1 },
                    },
                },
                { $sort: { count: -1 } },
                { $limit: PIPELINE_LIMIT },
            ]).option({ allowDiskUse: false, maxTimeMS: 3000 }),

            // 5. 24h failure rates per intent (actionable window)
            ChatMessage.aggregate([
                { $match: { role: 'assistant', createdAt: { $gte: twentyFourHoursAgo } } },
                {
                    $group: {
                        _id: '$intent',
                        total: { $sum: 1 },
                        failures: {
                            $sum: { $cond: [{ $ne: ['$errorCode', null] }, 1, 0] },
                        },
                    },
                },
                {
                    $project: {
                        _id: 1,
                        total: 1,
                        failures: 1,
                        failureRate: {
                            $cond: [
                                { $gt: ['$total', 0] },
                                { $round: [{ $multiply: [{ $divide: ['$failures', '$total'] }, 100] }, 2] },
                                0,
                            ],
                        },
                    },
                },
                { $sort: { failureRate: -1 } },
                { $limit: PIPELINE_LIMIT },
            ]).option({ allowDiskUse: false, maxTimeMS: 3000 }),
        ]);

        const totalQueries = distribution.reduce((acc, curr) => acc + curr.count, 0);
        const unknownQueries = distribution.find(d => d._id === 'unknown')?.count || 0;
        const fallbackRate = totalQueries > 0 ? (unknownQueries / totalQueries) * 100 : 0;

        // ── Drift detection ──
        const driftSeverity = classifyDriftSeverity(fallbackRate);
        if (shouldEmitDriftAlert(driftSeverity)) {
            logger.warn({
                module: 'ai-analytics',
                driftSeverity,
                fallbackRate: fallbackRate.toFixed(2),
                window: windowParam,
                totalQueries,
            }, `AI Drift Alert [${driftSeverity.toUpperCase()}]: fallback rate ${fallbackRate.toFixed(2)}% in ${windowParam} window`);
        }

        res.json({
            success: true,
            data: {
                window: windowParam,
                totalQueries,
                fallbackRate: fallbackRate.toFixed(2),
                intents: distribution,
                latency: latency[0] || { avg: 0, p50: 0, p95: 0, p99: 0 },
                errors,
                // Drift detection
                drift: {
                    severity: driftSeverity,
                    thresholds: DRIFT_THRESHOLDS,
                    fallbackRate: fallbackRate.toFixed(2),
                },
                // Handler failure counters
                failuresByIntent,
                failureRateLast24h: failures24h,
            },
        });
    } catch (err) {
        next(err);
    }
}
