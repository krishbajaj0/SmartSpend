import cron from 'node-cron';
import Expense from '../models/Expense.js';
import Budget from '../models/Budget.js';
import { createNotification } from '../controllers/notificationController.js';
import { generateInsights } from '../services/ai/insightsEngine.js';
import User from '../models/User.js';

/**
 * Initialize all cron jobs.
 */
export function initCronJobs() {
    // ── Daily midnight: Process recurring expenses ──
    cron.schedule('0 0 * * *', async () => {
        console.log('⏰ Running daily recurring expenses job...');
        try {
            const today = new Date();
            const recurringExpenses = await Expense.find({
                isRecurring: true,
                isDeleted: false,
                nextRecurrenceDate: { $lte: today },
            });

            for (const expense of recurringExpenses) {
                // Create new expense entry
                const newExpense = expense.toObject();
                delete newExpense._id;
                delete newExpense.createdAt;
                delete newExpense.updatedAt;
                newExpense.date = today;

                await Expense.create(newExpense);

                // Calculate next recurrence
                const next = new Date(today);
                switch (expense.recurringInterval) {
                    case 'daily': next.setDate(next.getDate() + 1); break;
                    case 'weekly': next.setDate(next.getDate() + 7); break;
                    case 'monthly': next.setMonth(next.getMonth() + 1); break;
                    case 'yearly': next.setFullYear(next.getFullYear() + 1); break;
                }
                expense.nextRecurrenceDate = next;
                await expense.save();
            }

            console.log(`✅ Processed ${recurringExpenses.length} recurring expenses`);
        } catch (err) {
            console.error('❌ Recurring expenses job error:', err.message);
        }
    });

    // ── Weekly (Sunday midnight): Weekly spending summary ──
    cron.schedule('0 0 * * 0', async () => {
        console.log('⏰ Running weekly summary job...');
        try {
            const users = await User.find({});
            const weekAgo = new Date();
            weekAgo.setDate(weekAgo.getDate() - 7);

            for (const user of users) {
                const expenses = await Expense.find({
                    userId: user._id, isDeleted: false, date: { $gte: weekAgo },
                });
                const total = expenses.reduce((s, e) => s + e.amount, 0);

                if (expenses.length > 0) {
                    await createNotification(
                        user._id, 'general',
                        'Weekly Spending Summary',
                        `You spent ₹${Math.round(total).toLocaleString()} across ${expenses.length} transactions this week`,
                        2
                    );
                }
            }
        } catch (err) {
            console.error('❌ Weekly summary job error:', err.message);
        }
    });

    // ── Monthly (1st midnight): Archive budgets & generate insights ──
    cron.schedule('0 0 1 * *', async () => {
        console.log('⏰ Running monthly reset job...');
        try {
            const now = new Date();
            const lastMonth = now.getMonth() === 0 ? 11 : now.getMonth() - 1;
            const lastYear = now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear();

            const budgets = await Budget.find({ isActive: true });
            const lastStart = new Date(lastYear, lastMonth, 1);
            const lastEnd = new Date(now.getFullYear(), now.getMonth(), 0);

            for (const budget of budgets) {
                const [agg] = await Expense.aggregate([
                    { $match: { userId: budget.userId, category: budget.category, isDeleted: false, date: { $gte: lastStart, $lte: lastEnd } } },
                    { $group: { _id: null, total: { $sum: '$amount' } } },
                ]);

                budget.history.push({
                    month: lastMonth + 1,
                    year: lastYear,
                    totalSpent: agg?.total || 0,
                    limitAmount: budget.limitAmount,
                });
                await budget.save();
            }

            // Generate fresh AI insights for all users
            const users = await User.find({});
            for (const user of users) {
                const insights = await generateInsights(user._id);
                if (insights.length > 0) {
                    await createNotification(
                        user._id, 'insight',
                        'Monthly AI Insights',
                        insights[0].message,
                        3
                    );
                }
            }

            console.log(`✅ Monthly reset — archived ${budgets.length} budgets`);
        } catch (err) {
            console.error('❌ Monthly reset job error:', err.message);
        }
    });

    console.log('📅 Cron jobs initialized');
}
