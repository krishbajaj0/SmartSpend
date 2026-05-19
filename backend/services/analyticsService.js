/**
 * @file services/analyticsService.js
 *
 * Phase 2: All aggregation pipelines get .option({ maxTimeMS }) to prevent
 * unbounded query execution. These functions are called from both the
 * dashboard route and the analytics controller, so the timeout must live here.
 */

import mongoose from 'mongoose';
import Transaction from '../models/Transaction.js';
import { ACTIVE_TRANSACTION_FILTER } from '../config/constants.js';

const QUERY_TIMEOUT = 3_000; // 3 s — below the HTTP request timeout (30 s)

/**
 * Monthly spending summary for a given user from startDate to now.
 */
export async function getMonthlySummary(userId, startDate) {
    const [agg] = await Transaction.aggregate([
        {
            $match: {
                userId: new mongoose.Types.ObjectId(userId),
                type: 'EXPENSE', ...ACTIVE_TRANSACTION_FILTER,
                date: { $gte: startDate },
            },
        },
        {
            $group: {
                _id:               null,
                totalSpent:        { $sum: '$amount' },
                totalTransactions: { $sum: 1 },
                avgAmount:         { $avg: '$amount' },
            },
        },
    ]).option({ maxTimeMS: QUERY_TIMEOUT });

    return {
        totalSpent:        agg?.totalSpent        || 0,
        totalTransactions: agg?.totalTransactions || 0,
        avgAmount:         agg?.avgAmount         || 0,
    };
}

/**
 * Spending breakdown by category from startDate to now, sorted descending.
 */
export async function getCategoryBreakdown(userId, startDate) {
    return Transaction.aggregate([
        {
            $match: {
                userId: new mongoose.Types.ObjectId(userId),
                type: 'EXPENSE', ...ACTIVE_TRANSACTION_FILTER,
                date: { $gte: startDate },
            },
        },
        {
            $group: {
                _id:    { $toLower: '$category' },
                amount: { $sum: '$amount' },
                count:  { $sum: 1 },
            },
        },
        { $sort: { amount: -1 } },
    ]).option({ maxTimeMS: QUERY_TIMEOUT });
}

/**
 * Returns the single top-spending category name from startDate to now.
 */
export async function getTopCategory(userId, startDate) {
    const data = await Transaction.aggregate([
        {
            $match: {
                userId: new mongoose.Types.ObjectId(userId),
                type: 'EXPENSE', ...ACTIVE_TRANSACTION_FILTER,
                date: { $gte: startDate },
            },
        },
        { $group: { _id: { $toLower: '$category' }, total: { $sum: '$amount' } } },
        { $sort: { total: -1 } },
        { $limit: 1 },
    ]).option({ maxTimeMS: QUERY_TIMEOUT });

    return data[0]?._id || 'none';
}

export async function computeAnalyticsFromExpenses(userId, options = {}) {
    const now = options.now || new Date();
    const startDate = options.startDate || new Date(now.getFullYear(), now.getMonth(), 1);

    const [summary, breakdown, topCategory] = await Promise.all([
        getMonthlySummary(userId, startDate),
        getCategoryBreakdown(userId, startDate),
        getTopCategory(userId, startDate),
    ]);

    const totalBreakdown = breakdown.reduce((sum, item) => sum + item.amount, 0);
    return {
        generatedAt: now.toISOString(),
        range: { startDate, endDate: now },
        summary: {
            totalSpent: Math.round(summary.totalSpent),
            totalTransactions: summary.totalTransactions,
            avgAmount: Math.round(summary.avgAmount),
            topCategory,
        },
        categoryBreakdown: breakdown.map(item => ({
            category: item._id,
            amount: Math.round(item.amount),
            count: item.count,
            percentage: totalBreakdown > 0 ? Math.round((item.amount / totalBreakdown) * 100) : 0,
        })),
    };
}
