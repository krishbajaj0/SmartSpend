import Budget from '../../models/Budget.js';
import Expense from '../../models/Expense.js';
import { createNotification } from '../../controllers/notificationController.js';

/**
 * Check budget alerts after a new expense is created.
 */
export async function checkBudgetAlerts(userId, category) {
    try {
        const budget = await Budget.findOne({ userId, category, isActive: true });
        if (!budget) return;

        const now = new Date();
        const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

        const [agg] = await Expense.aggregate([
            { $match: { userId, category, isDeleted: false, date: { $gte: monthStart } } },
            { $group: { _id: null, total: { $sum: '$amount' } } },
        ]);

        const spent = agg?.total || 0;
        const pct = (spent / budget.limitAmount) * 100;

        if (pct >= 100) {
            await createNotification(
                userId, 'budget_exceeded',
                `${category} Budget Exceeded!`,
                `You've spent ₹${Math.round(spent).toLocaleString()} — exceeding your ₹${budget.limitAmount.toLocaleString()} ${category} budget`,
                5, { category, spent, limit: budget.limitAmount }
            );
        } else if (pct >= budget.criticalThreshold) {
            await createNotification(
                userId, 'budget_critical',
                `${category} Budget Critical`,
                `You've used ${Math.round(pct)}% of your ${category} budget — only ₹${Math.round(budget.limitAmount - spent).toLocaleString()} remaining`,
                4, { category, percentage: pct }
            );
        } else if (pct >= budget.warningThreshold) {
            await createNotification(
                userId, 'budget_warning',
                `${category} Budget Warning`,
                `You've used ${Math.round(pct)}% of your ${category} budget`,
                3, { category, percentage: pct }
            );
        }
    } catch (err) {
        console.error('Budget alert check error:', err.message);
    }
}
