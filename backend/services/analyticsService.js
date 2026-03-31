import Expense from '../models/Expense.js';

/**
 * Reusable service for Analytics computations to avoid duplicating aggregation pipelines
 * across dashboard and analytics controllers.
 */

export async function getMonthlySummary(userId, startDate) {
    const [agg] = await Expense.aggregate([
        {
            $match: {
                userId,
                isDeleted: false,
                date: { $gte: startDate },
            },
        },
        {
            $group: {
                _id: null,
                totalSpent: { $sum: '$amount' },
                totalTransactions: { $sum: 1 },
                avgAmount: { $avg: '$amount' },
            },
        },
    ]);

    return {
        totalSpent: agg?.totalSpent || 0,
        totalTransactions: agg?.totalTransactions || 0,
        avgAmount: agg?.avgAmount || 0,
    };
}

export async function getCategoryBreakdown(userId, startDate) {
    const data = await Expense.aggregate([
        {
            $match: {
                userId,
                isDeleted: false,
                date: { $gte: startDate },
            },
        },
        {
            $group: {
                _id: '$category',
                amount: { $sum: '$amount' },
                count: { $sum: 1 },
            },
        },
        { $sort: { amount: -1 } },
    ]);

    return data;
}

export async function getTopCategory(userId, startDate) {
    const data = await Expense.aggregate([
        {
            $match: {
                userId,
                isDeleted: false,
                date: { $gte: startDate },
            },
        },
        { $group: { _id: '$category', total: { $sum: '$amount' } } },
        { $sort: { total: -1 } },
        { $limit: 1 },
    ]);

    return data[0]?._id || 'none';
}
