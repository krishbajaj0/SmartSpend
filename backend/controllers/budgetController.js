/**
 * @file controllers/budgetController.js
 *
 * Phase 2: All queries get .maxTimeMS() to cap execution time.
 * No logic changes — only timeout guards added.
 */

import Budget  from '../models/Budget.js';
import Transaction from '../models/Transaction.js';
import Account from '../models/Account.js';
import { AppError } from '../middleware/errorHandler.js';
import { writeAuditLog } from '../utils/audit.js';
import { ACTIVE_TRANSACTION_FILTER } from '../config/constants.js';
import { normalizeCategory } from '../utils/categoryNormalization.js';

const QUERY_TIMEOUT = 15_000;

// POST /api/budgets
export async function createOrUpdateBudget(req, res, next) {
    try {
        const { category, limitAmount, warningThreshold, criticalThreshold } = req.body;
        const normalizedCategory = normalizeCategory(category);
        const before = await Budget.findOne({ userId: req.user._id, category: normalizedCategory }).lean().maxTimeMS(QUERY_TIMEOUT);
        const budget = await Budget.findOneAndUpdate(
            { userId: req.user._id, category: normalizedCategory },
            { limitAmount, warningThreshold, criticalThreshold, isActive: true },
            { upsert: true, new: true, runValidators: true, setDefaultsOnInsert: true }
        ).maxTimeMS(QUERY_TIMEOUT);
        await writeAuditLog(req, {
            entityType: 'budget',
            entityId: budget._id,
            action: before ? 'update' : 'create',
            before,
            after: budget.toObject(),
        });
        res.json({ success: true, budget });
    } catch (err) { next(err); }
}

// GET /api/budgets
export async function getBudgets(req, res, next) {
    try {
        const now        = new Date();
        const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

        const [budgets, spending, accounts] = await Promise.all([
            Budget.find({ userId: req.user._id, isActive: true }).lean().maxTimeMS(QUERY_TIMEOUT),
            Transaction.aggregate([
                {
                    $match: {
                        userId:    req.user._id,
                        type: 'EXPENSE', ...ACTIVE_TRANSACTION_FILTER,
                        date:      { $gte: monthStart, $lte: now },
                    },
                },
                {
                    $group: {
                        _id:        { $toLower: '$category' },
                        totalSpent: { $sum: '$amount' },
                    },
                },
            ]).option({ maxTimeMS: QUERY_TIMEOUT }),
            Account.find({ userId: req.user._id, ...ACTIVE_TRANSACTION_FILTER }).select('balance').lean().maxTimeMS(QUERY_TIMEOUT),
        ]);

        const netWorth = (accounts || []).reduce((sum, acc) => sum + acc.balance, 0);

        const spendMap = {};
        let totalSpentAll = 0;
        spending.forEach(s => {
            spendMap[s._id] = s.totalSpent;
            totalSpentAll  += s.totalSpent;
        });

        const result = budgets.map(b => {
            const limit = b.category === 'overall' ? Math.max(0, netWorth) : b.limitAmount;
            const spent = b.category === 'overall' ? totalSpentAll : (spendMap[b.category] || 0);
            const percentage = limit > 0 ? Math.round((spent / limit) * 100) : 0;
            return {
                ...b,
                limitAmount: limit,
                currentSpent: Math.round(spent),
                percentage,
            };
        });

        res.json({ success: true, budgets: result });
    } catch (err) { next(err); }
}

// GET /api/budgets/status
export async function getBudgetStatus(req, res, next) {
    try {
        const now        = new Date();
        const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
        const daysInMonth   = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
        const daysPassed    = now.getDate();
        const daysRemaining = daysInMonth - daysPassed;

        const [budgets, spending, accounts] = await Promise.all([
            Budget.find({ userId: req.user._id, isActive: true }).lean().maxTimeMS(QUERY_TIMEOUT),
            Transaction.aggregate([
                {
                    $match: {
                        userId:    req.user._id,
                        type: 'EXPENSE', ...ACTIVE_TRANSACTION_FILTER,
                        date:      { $gte: monthStart },
                    },
                },
                {
                    $group: {
                        _id:        { $toLower: '$category' },
                        totalSpent: { $sum: '$amount' },
                    },
                },
            ]).option({ maxTimeMS: QUERY_TIMEOUT }),
            Account.find({ userId: req.user._id, ...ACTIVE_TRANSACTION_FILTER }).select('balance').lean().maxTimeMS(QUERY_TIMEOUT),
        ]);

        const netWorth = (accounts || []).reduce((sum, acc) => sum + acc.balance, 0);

        const spendMap = {};
        let totalSpentAll = 0;
        spending.forEach(s => {
            spendMap[s._id] = s.totalSpent;
            totalSpentAll  += s.totalSpent;
        });

        const status = budgets.map(b => {
            const limit           = b.category === 'overall' ? Math.max(0, netWorth) : b.limitAmount;
            const spent           = b.category === 'overall' ? totalSpentAll : (spendMap[b.category] || 0);
            const pct             = limit > 0 ? (spent / limit) * 100 : 0;
            const dailyRate       = daysPassed > 0 ? spent / daysPassed : 0;
            const projectedEOM    = Math.round(dailyRate * daysInMonth);

            let statusLabel = 'safe';
            if (pct >= 100)                       statusLabel = 'exceeded';
            else if (pct >= b.criticalThreshold)  statusLabel = 'critical';
            else if (pct >= b.warningThreshold)   statusLabel = 'warning';

            return {
                category:            b.category,
                limit,
                spent:               Math.round(spent),
                percentage:          Math.round(pct),
                status:              statusLabel,
                daysRemaining,
                projectedEndOfMonth: projectedEOM,
                dailyRate:           Math.round(dailyRate),
            };
        });

        res.json({ success: true, status });
    } catch (err) { next(err); }
}

// DELETE /api/budgets/:category
export async function deleteBudget(req, res, next) {
    try {
        const normalizedCategory = normalizeCategory(req.params.category);
        const before = await Budget.findOneAndUpdate(
            { userId: req.user._id, category: normalizedCategory },
            { isActive: false },
            { new: false }
        ).maxTimeMS(QUERY_TIMEOUT);
        await writeAuditLog(req, {
            entityType: 'budget',
            entityId: before?._id,
            action: 'delete',
            before: before?.toObject(),
            after: before ? { ...before.toObject(), isActive: false } : null,
        });
        res.json({ success: true, message: 'Budget removed' });
    } catch (err) { next(err); }
}
