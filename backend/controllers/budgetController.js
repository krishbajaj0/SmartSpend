import Budget from '../models/Budget.js';
import Expense from '../models/Expense.js';
import { AppError } from '../middleware/errorHandler.js';

// POST /api/budgets
export async function createOrUpdateBudget(req, res, next) {
    try {
        const { category, limitAmount, warningThreshold, criticalThreshold } = req.body;
        const budget = await Budget.findOneAndUpdate(
            { userId: req.user._id, category },
            { limitAmount, warningThreshold, criticalThreshold, isActive: true },
            { upsert: true, new: true, runValidators: true, setDefaultsOnInsert: true }
        );
        res.json({ success: true, budget });
    } catch (err) { next(err); }
}

// GET /api/budgets
export async function getBudgets(req, res, next) {
    try {
        const budgets = await Budget.find({ userId: req.user._id, isActive: true });

        // Calculate current spent per category for the current month
        const now = new Date();
        const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

        const spending = await Expense.aggregate([
            {
                $match: {
                    userId: req.user._id,
                    isDeleted: false,
                    date: { $gte: monthStart, $lte: now },
                },
            },
            { $group: { _id: '$category', totalSpent: { $sum: '$amount' } } },
        ]);

        const spendMap = {};
        let totalSpentAll = 0;
        spending.forEach(s => {
            spendMap[s._id] = s.totalSpent;
            totalSpentAll += s.totalSpent;
        });

        const result = budgets.map(b => {
             const spent = b.category === 'overall' ? totalSpentAll : (spendMap[b.category] || 0);
             return {
                 ...b.toObject(),
                 currentSpent: Math.round(spent),
                 percentage: Math.round((spent / b.limitAmount) * 100),
             }
        });

        res.json({ success: true, budgets: result });
    } catch (err) { next(err); }
}

// GET /api/budgets/status
export async function getBudgetStatus(req, res, next) {
    try {
        const budgets = await Budget.find({ userId: req.user._id, isActive: true });
        const now = new Date();
        const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
        const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
        const daysPassed = now.getDate();
        const daysRemaining = daysInMonth - daysPassed;

        const spending = await Expense.aggregate([
            { $match: { userId: req.user._id, isDeleted: false, date: { $gte: monthStart } } },
            { $group: { _id: '$category', totalSpent: { $sum: '$amount' } } },
        ]);

        const spendMap = {};
        let totalSpentAll = 0;
        spending.forEach(s => {
            spendMap[s._id] = s.totalSpent;
            totalSpentAll += s.totalSpent;
        });

        const status = budgets.map(b => {
            const spent = b.category === 'overall' ? totalSpentAll : (spendMap[b.category] || 0);
            const pct = (spent / b.limitAmount) * 100;
            const dailyRate = daysPassed > 0 ? spent / daysPassed : 0;
            const projectedEndOfMonth = Math.round(dailyRate * daysInMonth);

            let statusLabel = 'safe';
            if (pct >= 100) statusLabel = 'exceeded';
            else if (pct >= b.criticalThreshold) statusLabel = 'critical';
            else if (pct >= b.warningThreshold) statusLabel = 'warning';

            return {
                category: b.category,
                limit: b.limitAmount,
                spent: Math.round(spent),
                percentage: Math.round(pct),
                status: statusLabel,
                daysRemaining,
                projectedEndOfMonth,
                dailyRate: Math.round(dailyRate),
            };
        });

        res.json({ success: true, status });
    } catch (err) { next(err); }
}

// DELETE /api/budgets/:category
export async function deleteBudget(req, res, next) {
    try {
        await Budget.findOneAndUpdate(
            { userId: req.user._id, category: req.params.category },
            { isActive: false }
        );
        res.json({ success: true, message: 'Budget removed' });
    } catch (err) { next(err); }
}
