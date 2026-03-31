import Expense from '../models/Expense.js';
import * as analyticsService from '../services/analyticsService.js';

// GET /api/analytics/summary
export async function getSummary(req, res, next) {
    try {
        const now = new Date();
        const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
        
        const [summaryData, topCat] = await Promise.all([
            analyticsService.getMonthlySummary(req.user._id, monthStart),
            analyticsService.getTopCategory(req.user._id, monthStart)
        ]);

        const daysPassed = now.getDate();
        const totalSpent = summaryData.totalSpent;

        res.json({
            success: true,
            summary: {
                totalSpent: Math.round(totalSpent),
                totalTransactions: summaryData.totalTransactions,
                avgDaily: daysPassed > 0 ? Math.round(totalSpent / daysPassed) : 0,
                avgPerTransaction: Math.round(summaryData.avgAmount),
                topCategory: topCat,
            },
        });
    } catch (err) { next(err); }
}

// GET /api/analytics/category-breakdown
export async function getCategoryBreakdown(req, res, next) {
    try {
        const now = new Date();
        const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
        
        const data = await analyticsService.getCategoryBreakdown(req.user._id, monthStart);
        
        const total = data.reduce((s, d) => s + d.amount, 0);
        const breakdown = data.map(d => ({
            category: d._id,
            amount: Math.round(d.amount),
            count: d.count,
            percentage: total > 0 ? Math.round((d.amount / total) * 100) : 0,
        }));
        res.json({ success: true, breakdown, total: Math.round(total) });
    } catch (err) { next(err); }
}

// GET /api/analytics/monthly-trend
export async function getMonthlyTrend(req, res, next) {
    try {
        const now = new Date();
        const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
        const data = await Expense.aggregate([
            { $match: { userId: req.user._id, isDeleted: false, date: { $gte: monthStart } } },
            { $group: { _id: { $dayOfMonth: '$date' }, total: { $sum: '$amount' } } },
            { $sort: { _id: 1 } },
        ]);
        res.json({ success: true, trend: data.map(d => ({ day: d._id, amount: Math.round(d.total) })) });
    } catch (err) { next(err); }
}

// GET /api/analytics/comparison
export async function getComparison(req, res, next) {
    try {
        const now = new Date();
        const thisStart = new Date(now.getFullYear(), now.getMonth(), 1);
        const lastStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        const lastEnd = new Date(now.getFullYear(), now.getMonth(), 0);

        const [thisMonth, lastMonth] = await Promise.all([
            Expense.aggregate([
                { $match: { userId: req.user._id, isDeleted: false, date: { $gte: thisStart } } },
                { $group: { _id: '$category', total: { $sum: '$amount' } } },
            ]),
            Expense.aggregate([
                { $match: { userId: req.user._id, isDeleted: false, date: { $gte: lastStart, $lte: lastEnd } } },
                { $group: { _id: '$category', total: { $sum: '$amount' } } },
            ]),
        ]);

        const thisMap = {}; thisMonth.forEach(d => { thisMap[d._id] = d.total; });
        const lastMap = {}; lastMonth.forEach(d => { lastMap[d._id] = d.total; });
        const allCats = [...new Set([...Object.keys(thisMap), ...Object.keys(lastMap)])];

        res.json({
            success: true,
            comparison: allCats.map(c => ({
                category: c,
                thisMonth: Math.round(thisMap[c] || 0),
                lastMonth: Math.round(lastMap[c] || 0),
            })),
        });
    } catch (err) { next(err); }
}

// GET /api/analytics/weekly-pattern
export async function getWeeklyPattern(req, res, next) {
    try {
        const data = await Expense.aggregate([
            { $match: { userId: req.user._id, isDeleted: false } },
            { $group: { _id: { $dayOfWeek: '$date' }, avgSpend: { $avg: '$amount' }, total: { $sum: '$amount' }, count: { $sum: 1 } } },
            { $sort: { _id: 1 } },
        ]);
        const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
        res.json({
            success: true,
            pattern: data.map(d => ({ day: days[d._id - 1], avgSpend: Math.round(d.avgSpend), total: Math.round(d.total), count: d.count })),
        });
    } catch (err) { next(err); }
}

// GET /api/analytics/top-merchants
export async function getTopMerchants(req, res, next) {
    try {
        const data = await Expense.aggregate([
            { $match: { userId: req.user._id, isDeleted: false } },
            { $group: { _id: '$merchant', total: { $sum: '$amount' }, visits: { $sum: 1 } } },
            { $sort: { total: -1 } },
            { $limit: 10 },
        ]);
        res.json({
            success: true,
            merchants: data.map(d => ({ name: d._id, total: Math.round(d.total), visits: d.visits })),
        });
    } catch (err) { next(err); }
}

// GET /api/analytics/heatmap
export async function getHeatmap(req, res, next) {
    try {
        const yearAgo = new Date();
        yearAgo.setFullYear(yearAgo.getFullYear() - 1);
        const data = await Expense.aggregate([
            { $match: { userId: req.user._id, isDeleted: false, date: { $gte: yearAgo } } },
            { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$date' } }, total: { $sum: '$amount' } } },
        ]);
        const heatmap = {};
        data.forEach(d => { heatmap[d._id] = Math.round(d.total); });
        res.json({ success: true, heatmap });
    } catch (err) { next(err); }
}

// GET /api/analytics/category-over-time
export async function getCategoryOverTime(req, res, next) {
    try {
        const data = await Expense.aggregate([
            { $match: { userId: req.user._id, isDeleted: false } },
            {
                $group: {
                    _id: { month: { $month: '$date' }, year: { $year: '$date' }, category: '$category' },
                    total: { $sum: '$amount' },
                },
            },
            { $sort: { '_id.year': 1, '_id.month': 1 } },
        ]);
        res.json({ success: true, data });
    } catch (err) { next(err); }
}

// GET /api/analytics/export
export async function exportData(req, res, next) {
    try {
        const { format: fmt = 'json', dateFrom, dateTo } = req.query;
        const filter = { userId: req.user._id, isDeleted: false };
        if (dateFrom || dateTo) {
            filter.date = {};
            if (dateFrom) filter.date.$gte = new Date(dateFrom);
            if (dateTo) filter.date.$lte = new Date(dateTo);
        }

        const expenses = await Expense.find(filter).sort({ date: -1 }).lean();

        if (fmt === 'csv') {
            const header = 'Date,Merchant,Category,Amount,Notes,Tags,Recurring\n';
            const rows = expenses.map(e =>
                `${e.date?.toISOString()?.split('T')[0]},${e.merchant},${e.category},${e.amount},"${e.notes || ''}","${(e.tags || []).join(';')}",${e.isRecurring}`
            ).join('\n');
            res.setHeader('Content-Type', 'text/csv');
            res.setHeader('Content-Disposition', 'attachment; filename=expenses.csv');
            res.send(header + rows);
        } else {
            res.json({ success: true, data: expenses });
        }
    } catch (err) { next(err); }
}
