/**
 * @file routes/dashboard.js
 *
 * Phase 2: All queries get .maxTimeMS() to cap execution time.
 * This route makes 5 parallel DB calls — each one needs its own timeout
 * so a single slow query can't hold all 5 open indefinitely.
 *
 * No logic changes — timeout guards only.
 */

import express from 'express';
import { protect } from '../middleware/auth.js';
import mongoose from 'mongoose';
import Transaction from '../models/Transaction.js';
import Budget  from '../models/Budget.js';
import Account from '../models/Account.js';
import { getCache, setCache } from '../utils/cache.js';

const router = express.Router();
router.use(protect);

const QUERY_TIMEOUT = 3_000;
const pendingRequests = {};
const EXPENSE_PUBLIC_FIELDS = 'amount baseAmount merchant category date isRecurring tags notes currency';
import { ACTIVE_TRANSACTION_FILTER } from '../config/constants.js';

// GET /api/dashboard — consolidated dashboard endpoint
router.get('/', async (req, res, next) => {
    const userId = req.user._id;
    const cacheKey = `dashboard_${userId}`;
    // If client sends _t (cache-bust timestamp), skip cache entirely for fresh data
    const skipCache = !!req.query._t;
    const cached = !skipCache ? getCache(cacheKey) : null;
    
    if (cached && !cached.isStale) {
        return res.json(cached.data);
    }

    if (pendingRequests[cacheKey]) {
        try {
            const data = await pendingRequests[cacheKey];
            return res.json(data);
        } catch (err) {
            return next(err);
        }
    }

    const fetchDashboard = async () => {
        const now           = new Date();
        const startOfMonth  = new Date(now.getFullYear(), now.getMonth(), 1);
        const nextMonthStart = new Date(now.getFullYear(), now.getMonth() + 1, 1);
        const thirtyDaysAgo = new Date(now);
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

        // Four queries run in parallel — using $facet for the aggregations
        const [recentExpenses, budgets, accounts, facetData, totalTxCount] = await Promise.all([
            // Recent activities from the ledger (last 30 days)
            Transaction.find({ userId, ...ACTIVE_TRANSACTION_FILTER, date: { $gte: thirtyDaysAgo } })
                .sort({ date: -1 })
                .limit(50)
                .lean()
                .maxTimeMS(QUERY_TIMEOUT),

            // Active budgets
            Budget.find({ userId, isActive: true })
                .lean()
                .maxTimeMS(QUERY_TIMEOUT),

            // Accounts for Net Worth
            Account.find({ userId, ...ACTIVE_TRANSACTION_FILTER })
                .lean()
                .maxTimeMS(QUERY_TIMEOUT),

            // Unified Monthly summary and Category breakdown
            Transaction.aggregate([
                {
                    $match: {
                        userId: new mongoose.Types.ObjectId(userId),
                        type: 'EXPENSE', ...ACTIVE_TRANSACTION_FILTER,
                        date: { $gte: startOfMonth, $lt: nextMonthStart },
                    },
                },
                {
                    $facet: {
                        summary: [
                            {
                                $group: {
                                    _id: null,
                                    totalSpent: { $sum: '$amount' },
                                    totalTransactions: { $sum: 1 },
                                    avgAmount: { $avg: '$amount' },
                                },
                            },
                        ],
                        categoryBreakdown: [
                            {
                                $group: {
                                    _id: { $toLower: '$category' },
                                    amount: { $sum: '$amount' },
                                    count: { $sum: 1 },
                                },
                            },
                            { $sort: { amount: -1 } },
                        ],
                    },
                },
            ])
            .allowDiskUse(false)
            .option({ maxTimeMS: QUERY_TIMEOUT }),

            // Total count of ALL transactions (not just recent) to detect first-time empty state
            Transaction.countDocuments({ userId, ...ACTIVE_TRANSACTION_FILTER, type: 'EXPENSE' })
                .maxTimeMS(QUERY_TIMEOUT),
        ]);


        const summaryFacet = facetData[0].summary[0] || { totalSpent: 0, totalTransactions: 0, avgAmount: 0 };
        const categoryBreakdown = facetData[0].categoryBreakdown || [];

        const summary = {
            totalSpent:        summaryFacet.totalSpent,
            totalTransactions: summaryFacet.totalTransactions,
            avgTransaction:    summaryFacet.avgAmount,
        };
        const daysInMonth = now.getDate();
        summary.avgDaily = daysInMonth > 0 ? summary.totalSpent / daysInMonth : 0;

        // Build spend map for budget status enrichment
        const spendMap = {};
        let totalSpentAll = 0;
        categoryBreakdown.forEach(b => {
            spendMap[b._id] = b.amount;
            totalSpentAll  += b.amount;
        });

        const enrichedBudgets = budgets.map(b => {
            const spent = b.category === 'overall' ? totalSpentAll : (spendMap[b.category] || 0);
            return {
                ...b,
                currentSpent: Math.round(spent),
                percentage:   b.limitAmount > 0 ? Math.round((spent / b.limitAmount) * 100) : 0,
            };
        });

        const netWorth = (accounts || []).reduce((sum, acc) => sum + acc.balance, 0);

        // Create a map for quick account name lookups
        const accountMap = {};
        accounts.forEach(a => accountMap[a._id.toString()] = a.name);

        const enrichedTransactions = recentExpenses.map(tx => {
            const fromName = accountMap[tx.fromAccountId?.toString()];
            const toName = accountMap[tx.toAccountId?.toString()];
            
            return {
                ...tx,
                accountName: fromName || toName || 'Unknown',
                toAccountName: tx.type === 'TRANSFER' ? (toName || 'Unknown') : null
            };
        });

        const responseData = {
            success: true,
            recentTransactions: enrichedTransactions,
            budgets:           enrichedBudgets,
            summary,
            netWorth,
            accounts:          accounts.map(a => ({ name: a.name, balance: a.balance, type: a.type })),
            categoryBreakdown: categoryBreakdown.map(b => ({
                category: b._id,
                amount:   b.amount,
                count:    b.count,
            })),
            totalExpenseCount: totalTxCount,
        };


        // Cache dashboard for 30s
        setCache(cacheKey, responseData, 30);
        return responseData;
    };

    pendingRequests[cacheKey] = fetchDashboard();

    try {
        const data = await pendingRequests[cacheKey];
        res.json(data);
    } catch (err) {
        next(err);
    } finally {
        delete pendingRequests[cacheKey];
    }
});

export default router;
