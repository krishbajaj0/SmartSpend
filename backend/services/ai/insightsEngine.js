import Expense from '../../models/Expense.js';
import Budget from '../../models/Budget.js';
import { getSpendingPredictions } from './predictor.js';

/**
 * Generate personalized AI financial insights.
 */
export async function generateInsights(userId) {
    const insights = [];
    const now = new Date();
    const thisStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const lastStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const lastEnd = new Date(now.getFullYear(), now.getMonth(), 0);

    const [thisMonth, lastMonth] = await Promise.all([
        Expense.find({ userId, isDeleted: false, date: { $gte: thisStart } }),
        Expense.find({ userId, isDeleted: false, date: { $gte: lastStart, $lte: lastEnd } }),
    ]);

    const thisTotal = thisMonth.reduce((s, e) => s + e.amount, 0);
    const lastTotal = lastMonth.reduce((s, e) => s + e.amount, 0);

    // ── Category comparison vs last month ──
    const thisCat = {}; thisMonth.forEach(e => { thisCat[e.category] = (thisCat[e.category] || 0) + e.amount; });
    const lastCat = {}; lastMonth.forEach(e => { lastCat[e.category] = (lastCat[e.category] || 0) + e.amount; });

    for (const [cat, amount] of Object.entries(thisCat)) {
        const prev = lastCat[cat] || 0;
        if (prev > 0) {
            const change = ((amount - prev) / prev * 100).toFixed(0);
            if (Math.abs(change) >= 20) {
                const isLess = change < 0;
                insights.push({
                    type: 'category_trend',
                    message: `You've spent ${Math.abs(change)}% ${isLess ? 'less' : 'more'} on ${cat} this month compared to last month ${isLess ? '📉' : '📈'}`,
                    category: cat,
                    impact: isLess ? 'positive' : 'negative',
                    priority: isLess ? 2 : 4,
                    icon: isLess ? '📉' : '📈',
                });
            }
        }
    }

    // ── Top spending category ──
    if (Object.keys(thisCat).length > 0) {
        const topEntry = Object.entries(thisCat).sort((a, b) => b[1] - a[1])[0];
        const pct = thisTotal > 0 ? Math.round((topEntry[1] / thisTotal) * 100) : 0;
        insights.push({
            type: 'top_category',
            message: `Your top spending category is ${topEntry[0]} (${pct}% of total)`,
            category: topEntry[0],
            impact: 'neutral',
            priority: 3,
            icon: '🏷️',
        });
    }

    // ── Recurring subscriptions total ──
    const recurring = thisMonth.filter(e => e.isRecurring);
    if (recurring.length > 0) {
        const recurringTotal = recurring.reduce((s, e) => s + e.amount, 0);
        insights.push({
            type: 'subscriptions',
            message: `Your recurring subscriptions total ₹${Math.round(recurringTotal).toLocaleString()}/month. Review if all are still needed`,
            impact: 'neutral',
            priority: 2,
            icon: '🔄',
        });
    }

    // ── Savings estimate ──
    const predictions = await getSpendingPredictions(userId);
    if (predictions.projectedMonthEnd < lastTotal && lastTotal > 0) {
        const savings = lastTotal - predictions.projectedMonthEnd;
        insights.push({
            type: 'savings',
            message: `At your current rate, you'll save ₹${Math.round(savings).toLocaleString()} this month — ${Math.round((savings / lastTotal) * 100)}% more than last month!`,
            impact: 'positive',
            priority: 1,
            icon: '💰',
        });
    }

    // ── Weekend spending insight ──
    if (predictions.weekendInsight) {
        insights.push({
            type: 'pattern',
            message: predictions.weekendInsight,
            impact: 'negative',
            priority: 3,
            icon: '📅',
        });
    }

    // ── Budget warnings ──
    const budgets = await Budget.find({ userId, isActive: true });
    for (const b of budgets) {
        const spent = thisCat[b.category] || 0;
        const pct = (spent / b.limitAmount) * 100;
        if (pct >= 90 && pct < 100) {
            insights.push({
                type: 'budget_warning',
                message: `Your ${b.category} budget is at ${Math.round(pct)}% — ₹${Math.round(b.limitAmount - spent).toLocaleString()} remaining`,
                category: b.category,
                impact: 'negative',
                priority: 5,
                icon: '⚠️',
            });
        }
    }

    // Sort by priority (highest first) and return top 5
    insights.sort((a, b) => b.priority - a.priority);
    return insights.slice(0, 5);
}
