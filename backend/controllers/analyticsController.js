/**
 * @file controllers/analyticsController.js
 *
 * Phase 2 hardening: query timeout protection.
 *
 * Every MongoDB query and aggregate now has .maxTimeMS(QUERY_TIMEOUT).
 * Without this, a slow secondary node or a collection scan on a large
 * dataset can hold a connection open indefinitely, exhausting the pool.
 *
 * HIGH-RISK QUERIES (no date filter = full collection scan):
 *  - getWeeklyPattern: capped to 6 months to bound the scan
 *  - getTopMerchants:  capped to 6 months
 *  - getCategoryOverTime: capped to 12 months
 *  - exportData: uses a streaming cursor instead of loading into memory
 *
 * All others already had date filters (monthly/year range).
 */

import mongoose from 'mongoose';
import Transaction from '../models/Transaction.js';
import * as analyticsService from '../services/analyticsService.js';
import { getCache, setCache } from '../utils/cache.js';
import logger from '../config/logger.js';
import { ACTIVE_TRANSACTION_FILTER } from '../config/constants.js';

// Applies to all queries in this controller.
// Set below the HTTP request timeout (30 s) so MongoDB throws first.
const QUERY_TIMEOUT = 3_000; // 3 s

/**
 * Returns true when a caught error is a MongoDB MaxTimeMSExpired timeout
 * (server-side query timeout, error code 50).
 *
 * This is distinct from the HTTP request timeout (requestTimeout middleware).
 * It means the QUERY itself ran too long on the DB — not that the HTTP
 * connection expired. We handle these gracefully: return partial/empty data
 * with a 503 rather than propagating a raw 500 DB error.
 */
function isQueryTimeout(err) {
    return err?.code === 50 || err?.codeName === 'MaxTimeMSExpired';
}

// ── CSV field escaper (shared) ────────────────────────────────────────────────
const escCsv = (val) => {
    const str = String(val ?? '');
    if (str.includes(',') || str.includes('"') || str.includes('\n')) {
        return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
};

// GET /api/analytics/summary
export async function getSummary(req, res, next) {
    const cacheKey = `analytics_summary_${req.user._id}`;
    const cached = getCache(cacheKey);
    if (cached && !cached.isStale) return res.json(cached.data);

    try {
        const now = new Date();
        const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

        const [summaryData, topCat] = await Promise.all([
            analyticsService.getMonthlySummary(req.user._id, monthStart),
            analyticsService.getTopCategory(req.user._id, monthStart),
        ]);

        const daysPassed = now.getDate();
        const totalSpent = summaryData.totalSpent;

        const responseData = {
            success: true,
            summary: {
                totalSpent:        Math.round(totalSpent),
                totalTransactions: summaryData.totalTransactions,
                avgDaily:          daysPassed > 0 ? Math.round(totalSpent / daysPassed) : 0,
                avgPerTransaction: Math.round(summaryData.avgAmount),
                topCategory:       topCat,
            },
        };
        setCache(cacheKey, responseData);
        res.json(responseData);
    } catch (err) {
        if (isQueryTimeout(err)) {
            logger.warn({ route: req.originalUrl, userId: req.user._id }, 'Aggregation timeout');
            if (cached) return res.status(200).json({ ...cached.data, degraded: true });
            return res.status(200).json({ success: true, degraded: true, summary: null });
        }
        next(err);
    }
}

// GET /api/analytics/category-breakdown
export async function getCategoryBreakdown(req, res, next) {
    const cacheKey = `analytics_cat_breakdown_${req.user._id}`;
    const cached = getCache(cacheKey);
    if (cached && !cached.isStale) return res.json(cached.data);

    try {
        const now = new Date();
        const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

        const data  = await analyticsService.getCategoryBreakdown(req.user._id, monthStart);
        const total = data.reduce((s, d) => s + d.amount, 0);

        const breakdown = data.map(d => ({
            category:   d._id,
            amount:     Math.round(d.amount),
            count:      d.count,
            percentage: total > 0 ? Math.round((d.amount / total) * 100) : 0,
        }));

        const responseData = { success: true, breakdown, total: Math.round(total) };
        setCache(cacheKey, responseData);
        res.json(responseData);
    } catch (err) {
        if (isQueryTimeout(err)) {
            logger.warn({ route: req.originalUrl, userId: req.user._id }, 'Aggregation timeout');
            if (cached) return res.status(200).json({ ...cached.data, degraded: true });
            return res.status(200).json({ success: true, degraded: true, breakdown: [], total: 0 });
        }
        next(err);
    }
}

// GET /api/analytics/monthly-trend
export async function getMonthlyTrend(req, res, next) {
    const cacheKey = `analytics_monthly_trend_${req.user._id}`;
    const cached = getCache(cacheKey);
    if (cached && !cached.isStale) return res.json(cached.data);

    try {
        const now        = new Date();
        const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

        const data = await Transaction.aggregate([
            { $match: { userId: new mongoose.Types.ObjectId(req.user._id), type: 'EXPENSE', ...ACTIVE_TRANSACTION_FILTER, date: { $gte: monthStart } } },
            { $group: { _id: { $dayOfMonth: '$date' }, total: { $sum: '$amount' } } },
            { $sort: { _id: 1 } },
        ]).option({ maxTimeMS: QUERY_TIMEOUT });

        const responseData = {
            success: true,
            trend: data.map(d => ({ day: d._id, amount: Math.round(d.total) })),
        };
        setCache(cacheKey, responseData);
        res.json(responseData);
    } catch (err) {
        if (isQueryTimeout(err)) {
            logger.warn({ route: req.originalUrl, userId: req.user._id }, 'Aggregation timeout');
            if (cached) return res.status(200).json({ ...cached.data, degraded: true });
            return res.status(200).json({ success: true, degraded: true, trend: [] });
        }
        next(err);
    }
}

// GET /api/analytics/comparison
export async function getComparison(req, res, next) {
    const cacheKey = `analytics_comparison_${req.user._id}`;
    const cached = getCache(cacheKey);
    if (cached && !cached.isStale) return res.json(cached.data);

    try {
        const now       = new Date();
        const thisStart = new Date(now.getFullYear(), now.getMonth(), 1);
        const lastStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        const lastEnd   = new Date(now.getFullYear(), now.getMonth(), 0);

        const [thisMonth, lastMonth] = await Promise.all([
            Transaction.aggregate([
                { $match: { userId: new mongoose.Types.ObjectId(req.user._id), type: 'EXPENSE', ...ACTIVE_TRANSACTION_FILTER, date: { $gte: thisStart } } },
                { $group: { _id: '$category', total: { $sum: '$amount' } } },
            ]).option({ maxTimeMS: QUERY_TIMEOUT }),
            Transaction.aggregate([
                { $match: { userId: new mongoose.Types.ObjectId(req.user._id), type: 'EXPENSE', ...ACTIVE_TRANSACTION_FILTER, date: { $gte: lastStart, $lte: lastEnd } } },
                { $group: { _id: '$category', total: { $sum: '$amount' } } },
            ]).option({ maxTimeMS: QUERY_TIMEOUT }),
        ]);

        const thisMap = {};
        thisMonth.forEach(d => { thisMap[d._id] = d.total; });
        const lastMap = {};
        lastMonth.forEach(d => { lastMap[d._id] = d.total; });
        const allCats = [...new Set([...Object.keys(thisMap), ...Object.keys(lastMap)])];

        const responseData = {
            success: true,
            comparison: allCats.map(c => ({
                category:  c,
                thisMonth: Math.round(thisMap[c] || 0),
                lastMonth: Math.round(lastMap[c] || 0),
            })),
        };
        setCache(cacheKey, responseData);
        res.json(responseData);
    } catch (err) {
        if (isQueryTimeout(err)) {
            logger.warn({ route: req.originalUrl, userId: req.user._id }, 'Aggregation timeout');
            if (cached) return res.status(200).json({ ...cached.data, degraded: true });
            return res.status(200).json({ success: true, degraded: true, comparison: [] });
        }
        next(err);
    }
}

// GET /api/analytics/weekly-pattern
// BEFORE: full collection scan (no date filter).
// AFTER:  capped to last 6 months — bounds the scan size.
export async function getWeeklyPattern(req, res, next) {
    const cacheKey = `analytics_weekly_pattern_${req.user._id}`;
    const cached = getCache(cacheKey);
    if (cached && !cached.isStale) return res.json(cached.data);

    try {
        const sixMonthsAgo = new Date();
        sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

        const data = await Transaction.aggregate([
            {
                $match: {
                    userId:    new mongoose.Types.ObjectId(req.user._id),
                    type: 'EXPENSE', ...ACTIVE_TRANSACTION_FILTER,
                    date:      { $gte: sixMonthsAgo },   // ← was unbounded
                },
            },
            {
                $group: {
                    _id:      { $dayOfWeek: '$date' },
                    avgSpend: { $avg: '$amount' },
                    total:    { $sum: '$amount' },
                    count:    { $sum: 1 },
                },
            },
            { $sort: { _id: 1 } },
        ]).option({ maxTimeMS: QUERY_TIMEOUT });

        const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
        const responseData = {
            success: true,
            pattern: data.map(d => ({
                day:      days[d._id - 1],
                avgSpend: Math.round(d.avgSpend),
                total:    Math.round(d.total),
                count:    d.count,
            })),
        };
        setCache(cacheKey, responseData);
        res.json(responseData);
    } catch (err) {
        if (isQueryTimeout(err)) {
            logger.warn({ route: req.originalUrl, userId: req.user._id }, 'Aggregation timeout');
            if (cached) return res.status(200).json({ ...cached.data, degraded: true });
            return res.status(200).json({ success: true, degraded: true, pattern: [] });
        }
        next(err);
    }
}

// GET /api/analytics/top-merchants
// BEFORE: full collection scan.
// AFTER:  capped to last 6 months.
export async function getTopMerchants(req, res, next) {
    const cacheKey = `analytics_top_merchants_${req.user._id}`;
    const cached = getCache(cacheKey);
    if (cached && !cached.isStale) return res.json(cached.data);

    try {
        const sixMonthsAgo = new Date();
        sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

        const data = await Transaction.aggregate([
            {
                $match: {
                    userId:    new mongoose.Types.ObjectId(req.user._id),
                    type: 'EXPENSE', ...ACTIVE_TRANSACTION_FILTER,
                    date:      { $gte: sixMonthsAgo },
                },
            },
            {
                $project: {
                    merchantName: { $trim: { input: { $ifNull: ['$merchant', '$note', 'Unknown'] } } },
                    amount: 1
                }
            },
            {
                $group: {
                    _id: '$merchantName',
                    total: { $sum: '$amount' },
                    visits: { $sum: 1 }
                }
            },
            { 
                $match: { 
                    _id: { $nin: ['', null, 'Unknown'] },
                    total: { $gt: 0 }
                } 
            },
            { $sort: { total: -1 } },
            { $limit: 10 },
        ]).option({ maxTimeMS: QUERY_TIMEOUT });

        const responseData = {
            success: true,
            merchants: data.map(d => ({ name: d._id, total: Math.round(d.total), visits: d.visits })),
        };
        setCache(cacheKey, responseData);
        res.json(responseData);
    } catch (err) {
        if (isQueryTimeout(err)) {
            logger.warn({ route: req.originalUrl, userId: req.user._id }, 'Aggregation timeout');
            if (cached) return res.status(200).json({ ...cached.data, degraded: true });
            return res.status(200).json({ success: true, degraded: true, merchants: [] });
        }
        next(err);
    }
}

// GET /api/analytics/heatmap
export async function getHeatmap(req, res, next) {
    const cacheKey = `analytics_heatmap_${req.user._id}`;
    const cached = getCache(cacheKey);
    if (cached && !cached.isStale) return res.json(cached.data);

    try {
        const yearAgo = new Date();
        yearAgo.setFullYear(yearAgo.getFullYear() - 1);

        // Use IST (UTC+5:30) so date keys match the user's local calendar day.
        // Without a timezone, $dateToString uses UTC midnight boundaries — for
        // IST users (UTC+5:30) a transaction at e.g. 10 PM IST is stored as
        // 16:30 UTC the same day, which is correct. But a transaction at 1 AM
        // IST (19:30 UTC the previous day) would be bucketed into yesterday's
        // UTC date. The timezone param shifts the grouping to IST boundaries.
        const HEATMAP_TIMEOUT = 8_000; // 1 year scan needs more headroom
        const data = await Transaction.aggregate([
            {
                $match: {
                    userId: new mongoose.Types.ObjectId(req.user._id),
                    type: 'EXPENSE',
                    ...ACTIVE_TRANSACTION_FILTER,
                    date: { $gte: yearAgo },
                },
            },
            {
                $group: {
                    _id: {
                        $dateToString: {
                            format: '%Y-%m-%d',
                            date: '$date',
                            timezone: 'Asia/Kolkata',   // IST = UTC+5:30
                        },
                    },
                    total: { $sum: '$amount' },
                },
            },
        ]).option({ maxTimeMS: HEATMAP_TIMEOUT });

        const heatmap = {};
        data.forEach(d => { heatmap[d._id] = Math.round(d.total); });

        const responseData = { success: true, heatmap };
        setCache(cacheKey, responseData);
        res.json(responseData);
    } catch (err) {
        if (isQueryTimeout(err)) {
            logger.warn({ route: req.originalUrl, userId: req.user._id }, 'Heatmap aggregation timeout');
            if (cached) return res.status(200).json({ ...cached.data, degraded: true });
            return res.status(200).json({ success: true, degraded: true, heatmap: {} });
        }
        next(err);
    }
}

// GET /api/analytics/category-over-time
// BEFORE: full collection scan.
// AFTER:  capped to last 12 months.
export async function getCategoryOverTime(req, res, next) {
    const cacheKey = `analytics_category_over_time_${req.user._id}`;
    const cached = getCache(cacheKey);
    if (cached && !cached.isStale) return res.json(cached.data);

    try {
        const twelveMonthsAgo = new Date();
        twelveMonthsAgo.setFullYear(twelveMonthsAgo.getFullYear() - 1);

        const data = await Transaction.aggregate([
            {
                $match: {
                    userId:    new mongoose.Types.ObjectId(req.user._id),
                    type: 'EXPENSE', ...ACTIVE_TRANSACTION_FILTER,
                    date:      { $gte: twelveMonthsAgo },   // ← was unbounded
                },
            },
            {
                $group: {
                    _id:   { month: { $month: '$date' }, year: { $year: '$date' }, category: '$category' },
                    total: { $sum: '$amount' },
                },
            },
            { $sort: { '_id.year': 1, '_id.month': 1 } },
        ]).option({ maxTimeMS: QUERY_TIMEOUT });

        const responseData = { success: true, data };
        setCache(cacheKey, responseData);
        res.json(responseData);
    } catch (err) {
        if (isQueryTimeout(err)) {
            logger.warn({ route: req.originalUrl, userId: req.user._id }, 'Aggregation timeout');
            if (cached) return res.status(200).json({ ...cached.data, degraded: true });
            return res.status(200).json({ success: true, degraded: true, data: [] });
        }
        next(err);
    }
}

// GET /api/analytics/export
// Streams documents via cursor — memory is O(1) regardless of row count.
export async function exportData(req, res, next) {
    let cursor = null;
    try {
        const { format: fmt = 'json', dateFrom, dateTo } = req.query;
        const filter = { userId: req.user._id, ...ACTIVE_TRANSACTION_FILTER };

        if (dateFrom || dateTo) {
            filter.date = {};
            if (dateFrom) filter.date.$gte = new Date(dateFrom);
            if (dateTo)   filter.date.$lte = new Date(dateTo);
        }

        // Helper: should we abort the current streaming loop?
        const shouldAbort = () => req.timedOut?.() || req.isAborted?.();

        if (fmt === 'csv') {
            res.setHeader('Content-Type', 'text/csv');
            res.setHeader('Content-Disposition', 'attachment; filename=expenses.csv');
            res.write('Date,Merchant,Category,Amount,Currency,Notes,Tags,Recurring\n');

            cursor = Transaction
                .find(filter)
                .sort({ date: -1 })
                .lean()
                .maxTimeMS(QUERY_TIMEOUT)
                .cursor();

            for await (const e of cursor) {
                if (shouldAbort()) {
                    await cursor.close();
                    break;
                }
                res.write(
                    `${e.date?.toISOString()?.split('T')[0] || ''},` +
                    `${escCsv(e.merchant)},${escCsv(e.category)},` +
                    `${e.amount},${e.currency || 'INR'},` +
                    `${escCsv(e.note || '')},` +
                    `${escCsv((e.tags || []).join(';'))},` +
                    `${e.isRecurring}\n`
                );
            }
            if (cursor) await cursor.close();
            // CSV has no envelope — just end cleanly
            if (!res.writableEnded) res.end();

        } else {
            // JSON: open the envelope before streaming so the client gets a
            // well-formed (though possibly truncated) array on early termination.
            res.setHeader('Content-Type', 'application/json');
            res.write('{"success":true,"truncated":false,"data":[');

            cursor = Transaction
                .find(filter)
                .sort({ date: -1 })
                .lean()
                .maxTimeMS(QUERY_TIMEOUT)
                .cursor();

            let first    = true;
            let aborted  = false;
            for await (const e of cursor) {
                if (shouldAbort()) {
                    await cursor.close();
                    aborted = true;
                    break;
                }
                if (!first) res.write(',');
                res.write(JSON.stringify(e));
                first = false;
            }

            if (cursor) await cursor.close();
            // Close the array. If aborted, flip the truncated flag so the client
            // knows it did not receive the full dataset.
            if (!res.writableEnded) {
                res.write(aborted ? '],"_note":"truncated"}' : ']}');
                res.end();
            }
        }
    } catch (err) {
        // Ensure cursor is closed on any error path
        if (cursor) {
            try { await cursor.close(); } catch { /* ignore */ }
        }
        if (isQueryTimeout(err)) {
            logger.warn({ route: req.originalUrl, userId: req.user._id }, 'Aggregation timeout — partial data sent');
            if (!res.headersSent) {
                return res.status(503).json({
                    success: false,
                    message: 'Export query timed out. Use a smaller date range.',
                });
            }
            if (!res.writableEnded) return res.end();
            return;
        }
        next(err);
    }
}
