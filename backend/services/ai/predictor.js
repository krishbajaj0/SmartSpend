import Expense from '../../models/Expense.js';

/**
 * Spending prediction model.
 */
export async function getSpendingPredictions(userId) {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    const daysPassed = now.getDate();

    // Current month expenses
    const expenses = await Expense.find({
        userId, isDeleted: false, date: { $gte: monthStart },
    });

    const totalSpent = expenses.reduce((s, e) => s + e.amount, 0);
    const dailyRate = daysPassed > 0 ? totalSpent / daysPassed : 0;
    const projectedMonthEnd = Math.round(dailyRate * daysInMonth);

    // Category-level predictions
    const catSpend = {};
    expenses.forEach(e => {
        catSpend[e.category] = (catSpend[e.category] || 0) + e.amount;
    });

    const categoryPredictions = Object.entries(catSpend).map(([cat, spent]) => ({
        category: cat,
        spent: Math.round(spent),
        dailyRate: Math.round(spent / daysPassed),
        projected: Math.round((spent / daysPassed) * daysInMonth),
    }));

    // Weekly pattern analysis
    const dayOfWeekSpend = [0, 0, 0, 0, 0, 0, 0];
    const dayOfWeekCount = [0, 0, 0, 0, 0, 0, 0];
    expenses.forEach(e => {
        const dow = new Date(e.date).getDay();
        dayOfWeekSpend[dow] += e.amount;
        dayOfWeekCount[dow]++;
    });

    const weekdayAvg = dayOfWeekSpend.slice(1, 6).reduce((s, v) => s + v, 0) / Math.max(1, dayOfWeekCount.slice(1, 6).reduce((s, v) => s + v, 0));
    const weekendAvg = (dayOfWeekSpend[0] + dayOfWeekSpend[6]) / Math.max(1, dayOfWeekCount[0] + dayOfWeekCount[6]);
    const weekendMultiplier = weekdayAvg > 0 ? weekendAvg / weekdayAvg : 1;

    return {
        totalSpent: Math.round(totalSpent),
        dailyRate: Math.round(dailyRate),
        projectedMonthEnd,
        daysRemaining: daysInMonth - daysPassed,
        categoryPredictions,
        weekendMultiplier: Math.round(weekendMultiplier * 100) / 100,
        weekendInsight: weekendMultiplier > 1.3
            ? `You spend ${Math.round((weekendMultiplier - 1) * 100)}% more on weekends`
            : null,
    };
}
