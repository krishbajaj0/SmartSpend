import Expense from '../../models/Expense.js';

/**
 * Anomaly detection for expenses.
 */
export async function detectAnomalies(userId, newExpense = null) {
    const anomalies = [];

    const expenses = await Expense.find({
        userId, isDeleted: false,
    }).sort({ date: -1 }).limit(200);

    if (expenses.length < 5) return anomalies;

    // ── Unusual Amount ──
    if (newExpense) {
        const categoryExpenses = expenses.filter(e => e.category === newExpense.category);
        if (categoryExpenses.length >= 3) {
            const amounts = categoryExpenses.map(e => e.amount);
            const mean = amounts.reduce((s, a) => s + a, 0) / amounts.length;
            const stdDev = Math.sqrt(amounts.reduce((s, a) => s + (a - mean) ** 2, 0) / amounts.length);
            if (newExpense.amount > mean + 2 * stdDev) {
                const ratio = (newExpense.amount / mean).toFixed(1);
                anomalies.push({
                    type: 'unusual_amount',
                    message: `This ₹${newExpense.amount} ${newExpense.category} expense is ${ratio}x your average of ₹${Math.round(mean)}`,
                    severity: 'warning',
                    expense: newExpense,
                });
            }
        }
    }

    // ── Unusual Frequency (last 7 days) ──
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);
    const recentExpenses = expenses.filter(e => new Date(e.date) >= weekAgo);
    const catFrequency = {};
    recentExpenses.forEach(e => {
        catFrequency[e.category] = (catFrequency[e.category] || 0) + 1;
    });

    // Compare against prior 4 weeks average
    const fourWeeksAgo = new Date();
    fourWeeksAgo.setDate(fourWeeksAgo.getDate() - 28);
    const priorExpenses = expenses.filter(e => {
        const d = new Date(e.date);
        return d >= fourWeeksAgo && d < weekAgo;
    });
    const priorFreq = {};
    priorExpenses.forEach(e => {
        priorFreq[e.category] = (priorFreq[e.category] || 0) + 1;
    });

    for (const [cat, count] of Object.entries(catFrequency)) {
        const avgWeekly = (priorFreq[cat] || 0) / 3; // divide 3 weeks prior
        if (count > avgWeekly * 2 && count >= 4) {
            anomalies.push({
                type: 'unusual_frequency',
                message: `You've made ${count} ${cat} transactions this week vs. your average of ${Math.round(avgWeekly)}`,
                severity: 'info',
            });
        }
    }

    // ── Duplicate Detection ──
    if (newExpense) {
        const duplicates = expenses.filter(e => {
            if (e._id?.toString() === newExpense._id?.toString()) return false;
            const dayDiff = Math.abs(new Date(e.date) - new Date(newExpense.date)) / 86400000;
            return e.amount === newExpense.amount
                && e.merchantNormalized === (newExpense.merchant || '').toLowerCase().trim()
                && dayDiff <= 1;
        });
        if (duplicates.length > 0) {
            anomalies.push({
                type: 'duplicate',
                message: `Potential duplicate: same amount (₹${newExpense.amount}) and merchant (${newExpense.merchant}) found within 1 day`,
                severity: 'warning',
            });
        }
    }

    // ── New Merchant Alert ──
    if (newExpense) {
        const merchantHistory = expenses.filter(e =>
            e.merchantNormalized === (newExpense.merchant || '').toLowerCase().trim()
        );
        if (merchantHistory.length === 0) {
            anomalies.push({
                type: 'new_merchant',
                message: `First purchase at ${newExpense.merchant}`,
                severity: 'info',
            });
        }
    }

    return anomalies;
}
