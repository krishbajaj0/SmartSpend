import Expense from '../../models/Expense.js';

/**
 * Detect potential recurring expenses from spending history.
 */
export async function detectRecurringPatterns(userId) {
    const patterns = [];

    // Get last 3 months of non-recurring expenses
    const threeMonthsAgo = new Date();
    threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);

    const expenses = await Expense.find({
        userId,
        isDeleted: false,
        isRecurring: false,
        date: { $gte: threeMonthsAgo },
    }).sort({ date: -1 });

    // Group by normalized merchant
    const merchantGroups = {};
    expenses.forEach(e => {
        const key = e.merchantNormalized;
        if (!merchantGroups[key]) merchantGroups[key] = [];
        merchantGroups[key].push(e);
    });

    for (const [, group] of Object.entries(merchantGroups)) {
        if (group.length < 2) continue;

        // Check for similar amounts (within 10% tolerance)
        const amounts = group.map(e => e.amount);
        const avgAmount = amounts.reduce((s, a) => s + a, 0) / amounts.length;
        const withinTolerance = amounts.filter(a => Math.abs(a - avgAmount) / avgAmount < 0.1);

        if (withinTolerance.length < 2) continue;

        // Check for regular intervals
        const dates = group.map(e => new Date(e.date)).sort((a, b) => a - b);
        const intervals = [];
        for (let i = 1; i < dates.length; i++) {
            intervals.push(Math.round((dates[i] - dates[i - 1]) / 86400000));
        }

        const avgInterval = intervals.reduce((s, d) => s + d, 0) / intervals.length;

        let detectedInterval = null;
        if (avgInterval >= 25 && avgInterval <= 35) detectedInterval = 'monthly';
        else if (avgInterval >= 5 && avgInterval <= 9) detectedInterval = 'weekly';
        else if (avgInterval >= 350 && avgInterval <= 380) detectedInterval = 'yearly';

        if (detectedInterval) {
            patterns.push({
                merchant: group[0].merchant,
                category: group[0].category,
                amount: Math.round(avgAmount),
                interval: detectedInterval,
                occurrences: group.length,
                lastDate: dates[dates.length - 1],
                confidence: Math.min(0.95, 0.6 + (group.length * 0.1)),
            });
        }
    }

    return patterns.sort((a, b) => b.confidence - a.confidence);
}
