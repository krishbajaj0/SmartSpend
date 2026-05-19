/**
 * @file services/ai/healthScore.js
 *
 * Financial Health Score — a weighted 0-100 scoring algorithm evaluating
 * 7 financial factors to produce a single "health grade" for the user.
 *
 * Factors and weights:
 *   Budget Adherence      25%  — % of budgets staying under limit
 *   Savings Rate          20%  — (income - expenses) / income
 *   Spending Consistency  15%  — low daily variance = high score
 *   Emergency Fund        15%  — goal completion progress
 *   Tracking Regularity   10%  — days with logged expenses / total days
 *   Debt-to-Income        10%  — credit card balance / monthly income
 *   Category Diversity     5%  — entropy of spending across categories
 */

import mongoose from 'mongoose';
import Transaction from '../../models/Transaction.js';
import Budget from '../../models/Budget.js';
import Account from '../../models/Account.js';
import SavingsGoal from '../../models/SavingsGoal.js';
import User from '../../models/User.js';
import { ACTIVE_TRANSACTION_FILTER } from '../../config/constants.js';

const QUERY_TIMEOUT = 5_000;

/**
 * Calculate Financial Health Score for a user.
 * @param {ObjectId} userId
 * @returns {Promise<{score: number, grade: string, breakdown: Array, tips: Array}>}
 */
export async function calculateHealthScore(userId) {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const thirtyDaysAgo = new Date(now);
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    // Parallel data fetch
    const [user, budgets, spending, accounts, goals, dailyActivity, transactions] = await Promise.all([
        User.findById(userId).select('monthlyIncomeEstimate currency').lean().maxTimeMS(QUERY_TIMEOUT),

        Budget.find({ userId, isActive: true }).lean().maxTimeMS(QUERY_TIMEOUT),

        // Category spending this month
        Transaction.aggregate([
            { $match: { userId: new mongoose.Types.ObjectId(userId), type: 'EXPENSE', ...ACTIVE_TRANSACTION_FILTER, date: { $gte: monthStart } } },
            { $group: { _id: '$category', total: { $sum: '$amount' }, count: { $sum: 1 } } },
        ]).option({ maxTimeMS: QUERY_TIMEOUT }),

        Account.find({ userId, ...ACTIVE_TRANSACTION_FILTER }).lean().maxTimeMS(QUERY_TIMEOUT),

        SavingsGoal.find({ userId }).lean().maxTimeMS(QUERY_TIMEOUT),

        // Days with at least one expense in last 30 days
        Transaction.aggregate([
            { $match: { userId: new mongoose.Types.ObjectId(userId), type: 'EXPENSE', ...ACTIVE_TRANSACTION_FILTER, date: { $gte: thirtyDaysAgo } } },
            { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$date' } } } },
        ]).option({ maxTimeMS: QUERY_TIMEOUT }),

        // Income transactions this month
        Transaction.aggregate([
            { $match: { userId: new mongoose.Types.ObjectId(userId), type: 'INCOME', ...ACTIVE_TRANSACTION_FILTER, date: { $gte: monthStart } } },
            { $group: { _id: null, total: { $sum: '$amount' } } },
        ]).option({ maxTimeMS: QUERY_TIMEOUT }),
    ]);

    const spendMap = {};
    let totalSpent = 0;
    spending.forEach(s => {
        spendMap[s._id] = s.total;
        totalSpent += s.total;
    });

    const monthlyIncome = (transactions[0]?.total || 0) || (user?.monthlyIncomeEstimate || 0);

    const breakdown = [];
    const tips = [];

    // ── 1. Budget Adherence (25%) ───────────────────────────────────────────
    let budgetScore = 100;
    if (budgets.length > 0) {
        const categoryBudgets = budgets.filter(b => b.category !== 'overall');
        if (categoryBudgets.length > 0) {
            const adherentCount = categoryBudgets.filter(b => {
                const spent = spendMap[b.category] || 0;
                return spent <= b.limitAmount;
            }).length;
            budgetScore = Math.round((adherentCount / categoryBudgets.length) * 100);
        }
    } else {
        budgetScore = 0;
        tips.push({ type: 'budget', message: 'Set up budgets to improve your financial health score', priority: 'high' });
    }
    breakdown.push({ factor: 'Budget Adherence', weight: 25, score: budgetScore, detail: `${budgets.length > 0 ? `${Math.round(budgetScore)}% of budgets on track` : 'No budgets set'}` });

    // ── 2. Savings Rate (20%) ───────────────────────────────────────────────
    let savingsScore = 0;
    if (monthlyIncome > 0) {
        const savingsRate = Math.max(0, (monthlyIncome - totalSpent) / monthlyIncome);
        // 20%+ savings = 100 score, 0% = 0, negative = 0
        savingsScore = Math.min(100, Math.round(savingsRate * 500)); // 20% = 100
        if (savingsRate < 0.1) {
            tips.push({ type: 'savings', message: 'Try to save at least 10-20% of your income each month', priority: 'high' });
        }
        breakdown.push({ factor: 'Savings Rate', weight: 20, score: savingsScore, detail: `${Math.round(savingsRate * 100)}% of income saved` });
    } else {
        savingsScore = 50; // neutral if no income data
        tips.push({ type: 'income', message: 'Set your monthly income in Settings to unlock savings insights', priority: 'medium' });
        breakdown.push({ factor: 'Savings Rate', weight: 20, score: savingsScore, detail: 'No income data available' });
    }

    // ── 3. Spending Consistency (15%) ───────────────────────────────────────
    let consistencyScore = 50;
    if (dailyActivity.length >= 7) {
        // Calculate coefficient of variation of daily spending
        const dailyTotals = {};
        const dayKeys = dailyActivity.map(d => d._id);

        // Refetch daily totals
        const dailySpending = await Transaction.aggregate([
            { $match: { userId: new mongoose.Types.ObjectId(userId), type: 'EXPENSE', ...ACTIVE_TRANSACTION_FILTER, date: { $gte: thirtyDaysAgo } } },
            { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$date' } }, total: { $sum: '$amount' } } },
        ]).option({ maxTimeMS: QUERY_TIMEOUT });

        const amounts = dailySpending.map(d => d.total);
        const mean = amounts.reduce((s, a) => s + a, 0) / amounts.length;
        const variance = amounts.reduce((s, a) => s + Math.pow(a - mean, 2), 0) / amounts.length;
        const stdDev = Math.sqrt(variance);
        const cv = mean > 0 ? stdDev / mean : 0;

        // CV < 0.3 = very consistent (100), CV > 1.5 = very erratic (0)
        consistencyScore = Math.max(0, Math.min(100, Math.round((1.5 - cv) / 1.2 * 100)));
        if (cv > 1.0) {
            tips.push({ type: 'consistency', message: 'Your spending varies a lot day-to-day. Try setting daily spending limits.', priority: 'low' });
        }
    }
    breakdown.push({ factor: 'Spending Consistency', weight: 15, score: consistencyScore, detail: `${consistencyScore >= 70 ? 'Consistent' : consistencyScore >= 40 ? 'Moderate' : 'Erratic'} spending pattern` });

    // ── 4. Emergency Fund Progress (15%) ────────────────────────────────────
    let emergencyScore = 0;
    const activeGoals = goals.filter(g => g.status === 'active');
    if (goals.length > 0) {
        const totalProgress = goals.reduce((sum, g) => {
            return sum + Math.min(100, (g.currentAmount / g.targetAmount) * 100);
        }, 0);
        emergencyScore = Math.round(totalProgress / goals.length);
    } else {
        tips.push({ type: 'goals', message: 'Create a savings goal (e.g., Emergency Fund) to boost your score', priority: 'medium' });
    }
    breakdown.push({ factor: 'Savings Goals', weight: 15, score: emergencyScore, detail: `${goals.length} goal${goals.length !== 1 ? 's' : ''}, ${activeGoals.length} active` });

    // ── 5. Tracking Regularity (10%) ────────────────────────────────────────
    const daysInPeriod = Math.min(30, now.getDate());
    const activeDays = dailyActivity.length;
    const regularityScore = daysInPeriod > 0 ? Math.min(100, Math.round((activeDays / daysInPeriod) * 100)) : 0;
    if (regularityScore < 50) {
        tips.push({ type: 'tracking', message: 'Log expenses daily for better financial awareness', priority: 'medium' });
    }
    breakdown.push({ factor: 'Tracking Regularity', weight: 10, score: regularityScore, detail: `${activeDays} of last ${daysInPeriod} days tracked` });

    // ── 6. Debt-to-Income Ratio (10%) ───────────────────────────────────────
    let debtScore = 100;
    const creditCards = (accounts || []).filter(a => a.type === 'CREDIT_CARD');
    if (creditCards.length > 0 && monthlyIncome > 0) {
        const totalDebt = creditCards.reduce((sum, a) => sum + Math.abs(a.balance), 0);
        const dtiRatio = totalDebt / monthlyIncome;
        // DTI < 10% = 100, DTI > 50% = 0
        debtScore = Math.max(0, Math.min(100, Math.round((0.5 - dtiRatio) / 0.4 * 100)));
        if (dtiRatio > 0.3) {
            tips.push({ type: 'debt', message: 'Your credit card balance is high relative to income. Consider paying down debt.', priority: 'high' });
        }
    }
    breakdown.push({ factor: 'Debt-to-Income', weight: 10, score: debtScore, detail: creditCards.length > 0 ? `${creditCards.length} credit card${creditCards.length > 1 ? 's' : ''} tracked` : 'No credit cards' });

    // ── 7. Category Diversity (5%) ──────────────────────────────────────────
    let diversityScore = 0;
    const categories = spending.map(s => s.total);
    if (categories.length >= 2) {
        const total = categories.reduce((s, v) => s + v, 0);
        // Shannon entropy
        const entropy = categories.reduce((e, v) => {
            const p = v / total;
            return p > 0 ? e - p * Math.log2(p) : e;
        }, 0);
        const maxEntropy = Math.log2(categories.length);
        diversityScore = maxEntropy > 0 ? Math.round((entropy / maxEntropy) * 100) : 0;
    } else if (categories.length === 1) {
        diversityScore = 20;
        tips.push({ type: 'diversity', message: 'Track expenses across multiple categories for better insights', priority: 'low' });
    }
    breakdown.push({ factor: 'Category Diversity', weight: 5, score: diversityScore, detail: `${spending.length} categor${spending.length !== 1 ? 'ies' : 'y'} used` });

    // ── Weighted total ──────────────────────────────────────────────────────
    const weights = [25, 20, 15, 15, 10, 10, 5];
    const scores = [budgetScore, savingsScore, consistencyScore, emergencyScore, regularityScore, debtScore, diversityScore];
    const totalScore = Math.round(
        scores.reduce((sum, score, i) => sum + score * (weights[i] / 100), 0)
    );

    // Grade mapping
    let grade;
    if (totalScore >= 90) grade = 'A+';
    else if (totalScore >= 80) grade = 'A';
    else if (totalScore >= 70) grade = 'B+';
    else if (totalScore >= 60) grade = 'B';
    else if (totalScore >= 50) grade = 'C+';
    else if (totalScore >= 40) grade = 'C';
    else if (totalScore >= 30) grade = 'D';
    else grade = 'F';

    // Sort tips by priority
    const priorityOrder = { high: 0, medium: 1, low: 2 };
    tips.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);

    return {
        score: totalScore,
        grade,
        breakdown,
        tips: tips.slice(0, 3), // Top 3 most important tips
    };
}
