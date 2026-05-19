import Budget from '../../models/Budget.js';
import Transaction from '../../models/Transaction.js';
import Notification from '../../models/Notification.js';
import { createNotification } from '../../controllers/notificationController.js';

export async function checkBudgetAlerts(userId, category) {
    try {
        const budget = await Budget.findOne({ userId, category, isActive: true });
        if (!budget || !budget.limitAmount || budget.limitAmount <= 0) return;

        const now = new Date();
        const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));

        const [agg] = await Transaction.aggregate([
        { $match: { type: 'EXPENSE', isDeleted: false,  userId, category, isDeleted: false, date: { $gte: monthStart } } },
            { $group: { _id: null, total: { $sum: { $ifNull: ['$baseAmount', '$amount'] } } } },
        ]);

        const spent = agg?.total || 0;
        const pct = (spent / budget.limitAmount) * 100;
        const monthKey = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}`;

        async function createBudgetAlert(level, type, title, message, priority, metadata) {
            const dedupeKey = `${userId}:${category}:${monthKey}:${level}`;
            const existing = await Notification.findOne({ userId, type, 'metadata.dedupeKey': dedupeKey }).lean();
            if (existing) return;
            await createNotification(userId, type, title, message, priority, {
                ...metadata,
                category,
                monthKey,
                level,
                dedupeKey,
            });
        }

        if (pct >= 100) {
            await createBudgetAlert(
                'exceeded',
                'budget_exceeded',
                `${category} Budget Exceeded!`,
                `You spent ${Math.round(spent).toLocaleString()}, exceeding your ${budget.limitAmount.toLocaleString()} ${category} budget`,
                5,
                { spent, limit: budget.limitAmount }
            );
        } else if (pct >= budget.criticalThreshold) {
            await createBudgetAlert(
                'critical',
                'budget_critical',
                `${category} Budget Critical`,
                `You used ${Math.round(pct)}% of your ${category} budget; only ${Math.round(budget.limitAmount - spent).toLocaleString()} remaining`,
                4,
                { percentage: pct }
            );
        } else if (pct >= budget.warningThreshold) {
            await createBudgetAlert(
                'warning',
                'budget_warning',
                `${category} Budget Warning`,
                `You used ${Math.round(pct)}% of your ${category} budget`,
                3,
                { percentage: pct }
            );
        }
    } catch (err) {
        console.error('Budget alert check error:', err.message);
    }
}
