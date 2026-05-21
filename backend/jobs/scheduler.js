import cron from 'node-cron';
import Transaction from '../models/Transaction.js';
import Budget from '../models/Budget.js';
import { createNotification } from '../controllers/notificationController.js';
import { generateInsights } from '../services/ai/insightsEngine.js';
import User from '../models/User.js';
import { runWithJobLock } from '../utils/jobLock.js';
import { ACTIVE_TRANSACTION_FILTER } from '../config/constants.js';

/**
 * Initialize all cron jobs.
 * All jobs use batch aggregation pipelines instead of N+1 per-user loops.
 */
export function initCronJobs() {
    // ── Daily midnight: Process recurring expenses ──
    cron.schedule('0 0 * * *', () => runWithJobLock('recurring-expenses-daily', async () => {
        console.log('⏰ Running daily recurring expenses job...');
        try {
            const today = new Date();
            const recurringExpenses = await Transaction.find({ type: 'EXPENSE', ...ACTIVE_TRANSACTION_FILTER, 
                isRecurring: true,
                ...ACTIVE_TRANSACTION_FILTER,
                nextRecurrenceDate: { $lte: today },
            });

            // Batch: prepare all new docs + updates at once
            const newDocs = [];
            const bulkOps = [];

            for (const expense of recurringExpenses) {
                const newExpense = expense.toObject();
                delete newExpense._id;
                delete newExpense.createdAt;
                delete newExpense.updatedAt;
                newExpense.date = today;
                newDocs.push(newExpense);

                // Calculate next recurrence
                const next = new Date(today);
                switch (expense.recurringInterval) {
                    case 'daily': next.setDate(next.getDate() + 1); break;
                    case 'weekly': next.setDate(next.getDate() + 7); break;
                    case 'monthly': next.setMonth(next.getMonth() + 1); break;
                    case 'yearly': next.setFullYear(next.getFullYear() + 1); break;
                }
                bulkOps.push({
                    updateOne: {
                        filter: { _id: expense._id },
                        update: { $set: { nextRecurrenceDate: next } },
                    },
                });
            }

            if (newDocs.length > 0) {
                await Transaction.insertMany(newDocs, { ordered: false });
                await Transaction.bulkWrite(bulkOps, { ordered: false });
            }

            console.log(`✅ Processed ${recurringExpenses.length} recurring expenses`);
        } catch (err) {
            console.error('❌ Recurring expenses job error:', err.message);
        }
    }));

    // ── Weekly (Sunday midnight): Weekly spending summary ──
    // Uses a single aggregation pipeline instead of N+1 queries per user.
    cron.schedule('0 0 * * 0', () => runWithJobLock('weekly-spending-summary', async () => {
        console.log('⏰ Running weekly summary job...');
        try {
            const weekAgo = new Date();
            weekAgo.setDate(weekAgo.getDate() - 7);

            // Single aggregation: group spending by user
            const results = await Transaction.aggregate([
        { $match: { type: 'EXPENSE', ...ACTIVE_TRANSACTION_FILTER,  ...ACTIVE_TRANSACTION_FILTER, date: { $gte: weekAgo } } },
                { $group: {
                    _id: '$userId',
                    total: { $sum: { $ifNull: ['$baseAmount', '$amount'] } },
                    count: { $sum: 1 },
                }},
            ]);

            // Batch notifications
            const notifications = results
                .filter(r => r.count > 0)
                .map(r => ({
                    userId: r._id,
                    type: 'general',
                    title: 'Weekly Spending Summary',
                    message: `You spent ${Math.round(r.total).toLocaleString()} across ${r.count} transactions this week`,
                    priority: 2,
                }));

            if (notifications.length > 0) {
                const { default: Notification } = await import('../models/Notification.js');
                await Notification.insertMany(notifications, { ordered: false });
            }
        } catch (err) {
            console.error('❌ Weekly summary job error:', err.message);
        }
    }));

    // ── Daily (8:00 PM): Daily spending summary ──
    // Uses a single aggregation pipeline instead of N+1 queries per user.
    cron.schedule('0 20 * * *', () => runWithJobLock('daily-spending-summary', async () => {
        console.log('⏰ Running daily summary job...');
        try {
            const startOfDay = new Date();
            startOfDay.setHours(0, 0, 0, 0);
            const endOfDay = new Date();
            endOfDay.setHours(23, 59, 59, 999);

            // Single aggregation: group today's spending by user
            const results = await Transaction.aggregate([
        { $match: { type: 'EXPENSE', ...ACTIVE_TRANSACTION_FILTER,  ...ACTIVE_TRANSACTION_FILTER, date: { $gte: startOfDay, $lte: endOfDay } } },
                { $group: {
                    _id: '$userId',
                    total: { $sum: { $ifNull: ['$baseAmount', '$amount'] } },
                    count: { $sum: 1 },
                }},
            ]);

            const notifications = results
                .filter(r => r.count > 0)
                .map(r => ({
                    userId: r._id,
                    type: 'general',
                    title: 'Daily Spending Summary',
                    message: `You spent ${Math.round(r.total).toLocaleString()} across ${r.count} transactions today.`,
                    priority: 2,
                }));

            if (notifications.length > 0) {
                const { default: Notification } = await import('../models/Notification.js');
                await Notification.insertMany(notifications, { ordered: false });
            }
        } catch (err) {
            console.error('❌ Daily summary job error:', err.message);
        }
    }));

    // ── Daily (9:00 PM): No expenses logged reminder ──
    // Uses single aggregation to find users WITH expenses, then notifies the rest.
    cron.schedule('0 21 * * *', () => runWithJobLock('no-expenses-reminder', async () => {
        console.log('⏰ Running no-expenses reminder job...');
        try {
            const startOfDay = new Date();
            startOfDay.setHours(0, 0, 0, 0);

            // Get distinct userIds who have logged expenses today
            const activeUserIds = await Transaction.distinct('userId', {
                ...ACTIVE_TRANSACTION_FILTER,
                date: { $gte: startOfDay },
            });

            // Find all users NOT in the active set
            const inactiveUsers = await User.find(
                { _id: { $nin: activeUserIds } },
                { _id: 1 }
            ).lean();

            const notifications = inactiveUsers.map(u => ({
                userId: u._id,
                type: 'insight',
                title: 'Nothing logged today?',
                message: "If you made any purchases today, don't forget to log them to keep your budget accurate!",
                priority: 2,
            }));

            if (notifications.length > 0) {
                const { default: Notification } = await import('../models/Notification.js');
                await Notification.insertMany(notifications, { ordered: false });
            }
        } catch (err) {
            console.error('❌ No-expenses reminder job error:', err.message);
        }
    }));

    // ── Monthly (1st midnight): Archive budgets & generate insights ──
    // Budget history archival uses a single aggregation for all budgets.
    cron.schedule('0 0 1 * *', () => runWithJobLock('monthly-budget-archive', async () => {
        console.log('⏰ Running monthly reset job...');
        try {
            const now = new Date();
            const lastMonth = now.getMonth() === 0 ? 11 : now.getMonth() - 1;
            const lastYear = now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear();
            const lastStart = new Date(lastYear, lastMonth, 1);
            const thisStart = new Date(now.getFullYear(), now.getMonth(), 1);

            const budgets = await Budget.find({ isActive: true }).lean();

            // Single aggregation: get totals per (userId, category) for last month
            const spendAgg = await Transaction.aggregate([
        { $match: { type: 'EXPENSE', ...ACTIVE_TRANSACTION_FILTER,  ...ACTIVE_TRANSACTION_FILTER, date: { $gte: lastStart, $lt: thisStart } } },
                { $group: {
                    _id: { userId: '$userId', category: '$category' },
                    total: { $sum: { $ifNull: ['$baseAmount', '$amount'] } },
                }},
            ]);

            // Build lookup map: "userId:category" -> total
            const spendMap = {};
            for (const row of spendAgg) {
                spendMap[`${row._id.userId}:${row._id.category}`] = row.total;
            }

            // Bulk update all budgets with archived history
            const bulkOps = budgets.map(b => ({
                updateOne: {
                    filter: { _id: b._id },
                    update: {
                        $push: {
                            history: {
                                month: lastMonth + 1,
                                year: lastYear,
                                totalSpent: spendMap[`${b.userId}:${b.category}`] || 0,
                                limitAmount: b.limitAmount,
                            },
                        },
                    },
                },
            }));

            if (bulkOps.length > 0) {
                await Budget.bulkWrite(bulkOps, { ordered: false });
            }

            // Generate AI insights (inherently per-user, but parallelized)
            const users = await User.find({}, { _id: 1 }).lean();
            const insightResults = await Promise.allSettled(
                users.map(u => generateInsights(u._id))
            );

            const insightNotifs = [];
            insightResults.forEach((result, i) => {
                if (result.status === 'fulfilled' && result.value?.length > 0) {
                    insightNotifs.push({
                        userId: users[i]._id,
                        type: 'insight',
                        title: 'Monthly AI Insights',
                        message: result.value[0].message,
                        priority: 3,
                    });
                }
            });

            if (insightNotifs.length > 0) {
                const { default: Notification } = await import('../models/Notification.js');
                await Notification.insertMany(insightNotifs, { ordered: false });
            }

            console.log(`✅ Monthly reset — archived ${budgets.length} budgets`);
        } catch (err) {
            console.error('❌ Monthly reset job error:', err.message);
        }
    }));

    // ── Daily (2:00 AM): Clean up unverified stale users after 24h ──
    cron.schedule('0 2 * * *', () => runWithJobLock('cleanup-unverified-stale-users', async () => {
        console.log('⏰ Running unverified stale users cleanup job...');
        try {
            const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
            
            // Delete users that were created more than 24 hours ago and are still not verified
            const deletedUsers = await User.deleteMany({
                isVerified: false,
                createdAt: { $lt: twentyFourHoursAgo }
            });

            console.log(`✅ Cleaned up ${deletedUsers.deletedCount} unverified stale users.`);
        } catch (err) {
            console.error('❌ Stale user cleanup job error:', err.message);
        }
    }));

    console.log('📅 Cron jobs initialized');
}
