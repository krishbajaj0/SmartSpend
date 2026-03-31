import Expense from '../../models/Expense.js';

/**
 * AI Budget advisor — suggest budget limits based on spending history.
 */
export async function getBudgetRecommendations(userId) {
    const recommendations = [];
    const threeMonthsAgo = new Date();
    threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);

    const expenses = await Expense.find({
        userId, isDeleted: false, date: { $gte: threeMonthsAgo },
    });

    if (expenses.length === 0) return recommendations;

    // Group by category and month
    const catMonthly = {};
    expenses.forEach(e => {
        const key = e.category;
        const monthKey = `${new Date(e.date).getFullYear()}-${new Date(e.date).getMonth()}`;
        if (!catMonthly[key]) catMonthly[key] = {};
        if (!catMonthly[key][monthKey]) catMonthly[key][monthKey] = 0;
        catMonthly[key][monthKey] += e.amount;
    });

    for (const [category, months] of Object.entries(catMonthly)) {
        const monthlyTotals = Object.values(months);
        if (monthlyTotals.length === 0) continue;

        const avg = monthlyTotals.reduce((s, v) => s + v, 0) / monthlyTotals.length;
        const max = Math.max(...monthlyTotals);

        // 3 tier recommendations
        recommendations.push({
            category,
            avgMonthly: Math.round(avg),
            tiers: {
                tight: Math.round(avg * 0.8),
                comfortable: Math.round(avg),
                flexible: Math.round(avg * 1.2),
            },
            monthsOfData: monthlyTotals.length,
            maxSpent: Math.round(max),
            suggestion: max > avg * 1.3
                ? `Your ${category} spending varies a lot — consider the flexible tier`
                : `Your ${category} spending is consistent — the comfortable tier should work`,
        });
    }

    return recommendations.sort((a, b) => b.avgMonthly - a.avgMonthly);
}
