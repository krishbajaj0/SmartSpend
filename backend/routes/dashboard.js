import express from 'express';
import { protect } from '../middleware/auth.js';
import Expense from '../models/Expense.js';
import Budget from '../models/Budget.js';
import * as analyticsService from '../services/analyticsService.js';

const router = express.Router();
router.use(protect);

// GET /api/dashboard — consolidated dashboard endpoint
router.get('/', async (req, res, next) => {
    try {
        const userId = req.user._id;
        const now = new Date();
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

        // Run all queries in parallel
        const [recentExpenses, budgets, monthlySummary, categoryBreakdown] = await Promise.all([
            // Recent expenses
            Expense.find({ userId, isDeleted: false })
                .sort({ date: -1 })
                .limit(6)
                .lean(),

            // User budgets
            Budget.find({ userId }).lean(),

            // Monthly summary
            analyticsService.getMonthlySummary(userId, startOfMonth),

            // Category breakdown
            analyticsService.getCategoryBreakdown(userId, startOfMonth),
        ]);

        const summary = {
            totalSpent: monthlySummary.totalSpent,
            totalTransactions: monthlySummary.totalTransactions,
            avgTransaction: monthlySummary.avgAmount,
        };

        const daysInMonth = now.getDate();
        summary.avgDaily = daysInMonth > 0 ? summary.totalSpent / daysInMonth : 0;

        res.json({
            success: true,
            recentExpenses,
            budgets,
            summary,
            categoryBreakdown: categoryBreakdown.map(b => ({
                category: b._id,
                amount: b.amount,
                count: b.count,
            })),
        });
    } catch (err) {
        next(err);
    }
});

export default router;
