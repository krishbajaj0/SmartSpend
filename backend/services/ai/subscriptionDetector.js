import Expense from '../../models/Expense.js';

/**
 * Detect subscription/recurring payments from expense history.
 */
export async function detectSubscriptions(userId) {
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

    const expenses = await Expense.find({
        userId,
        isDeleted: false,
        date: { $gte: sixMonthsAgo },
    }).sort({ date: 1 });

    if (expenses.length < 3) return [];

    // Group by merchant + similar amount (within 10%)
    const merchantGroups = {};
    expenses.forEach(e => {
        const key = e.merchantNormalized;
        if (!merchantGroups[key]) merchantGroups[key] = [];
        merchantGroups[key].push(e);
    });

    const subscriptions = [];

    for (const [merchantKey, group] of Object.entries(merchantGroups)) {
        if (group.length < 2) continue;

        // Find amount clusters (same amount ± 10%)
        const amountClusters = [];
        const used = new Set();

        for (let i = 0; i < group.length; i++) {
            if (used.has(i)) continue;
            const cluster = [group[i]];
            used.add(i);

            for (let j = i + 1; j < group.length; j++) {
                if (used.has(j)) continue;
                const diff = Math.abs(group[i].amount - group[j].amount);
                if (diff / group[i].amount < 0.1) {
                    cluster.push(group[j]);
                    used.add(j);
                }
            }

            if (cluster.length >= 2) {
                amountClusters.push(cluster);
            }
        }

        for (const cluster of amountClusters) {
            // Sort by date and check intervals
            cluster.sort((a, b) => new Date(a.date) - new Date(b.date));
            const intervals = [];
            for (let i = 1; i < cluster.length; i++) {
                const days = Math.round(
                    (new Date(cluster[i].date) - new Date(cluster[i - 1].date)) / 86400000
                );
                intervals.push(days);
            }

            if (intervals.length === 0) continue;

            const avgInterval = intervals.reduce((s, d) => s + d, 0) / intervals.length;
            const avgAmount = Math.round(cluster.reduce((s, e) => s + e.amount, 0) / cluster.length);

            // Detect interval type
            let intervalType = null;
            let confidence = 0;

            if (avgInterval >= 25 && avgInterval <= 35) {
                intervalType = 'monthly';
                confidence = Math.min(0.95, 0.6 + cluster.length * 0.1);
            } else if (avgInterval >= 5 && avgInterval <= 9) {
                intervalType = 'weekly';
                confidence = Math.min(0.9, 0.5 + cluster.length * 0.1);
            } else if (avgInterval >= 85 && avgInterval <= 95) {
                intervalType = 'quarterly';
                confidence = Math.min(0.9, 0.55 + cluster.length * 0.1);
            } else if (avgInterval >= 350 && avgInterval <= 380) {
                intervalType = 'yearly';
                confidence = Math.min(0.95, 0.6 + cluster.length * 0.1);
            }

            if (intervalType) {
                const lastDate = new Date(cluster[cluster.length - 1].date);
                const nextDate = new Date(lastDate);
                if (intervalType === 'monthly') nextDate.setMonth(nextDate.getMonth() + 1);
                else if (intervalType === 'weekly') nextDate.setDate(nextDate.getDate() + 7);
                else if (intervalType === 'quarterly') nextDate.setMonth(nextDate.getMonth() + 3);
                else if (intervalType === 'yearly') nextDate.setFullYear(nextDate.getFullYear() + 1);

                subscriptions.push({
                    merchant: cluster[0].merchant,
                    merchantNormalized: merchantKey,
                    amount: avgAmount,
                    interval: intervalType,
                    category: cluster[0].category,
                    occurrences: cluster.length,
                    avgInterval: Math.round(avgInterval),
                    confidence,
                    lastDate: lastDate.toISOString(),
                    nextExpectedDate: nextDate.toISOString(),
                    isConverted: cluster.some(e => e.isRecurring),
                });
            }
        }
    }

    return subscriptions
        .sort((a, b) => b.confidence - a.confidence || b.amount - a.amount);
}
