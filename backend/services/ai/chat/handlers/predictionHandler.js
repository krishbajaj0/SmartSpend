/**
 * @file services/ai/chat/handlers/predictionHandler.js
 *
 * Handles the `prediction` intent by routing to predictor.getSpendingPredictions.
 * Formats projected spending, daily rate, and category predictions.
 */

import { getSpendingPredictions } from '../../predictor.js';

/**
 * @param {ObjectId} userId
 * @param {string} message
 * @param {object} entities
 * @returns {Promise<object>} Structured response
 */
export async function handle(userId, _message, entities) {
    const result = await getSpendingPredictions(userId);
    const {
        totalSpent,
        dailyRate,
        projectedMonthEnd,
        daysRemaining,
        categoryPredictions,
        weekendMultiplier,
        weekendInsight,
    } = result;

    // ── Empty state ──
    if (totalSpent === 0) {
        return {
            type: 'prediction',
            text: "I don't have enough spending data to make predictions yet. Start tracking your expenses and I'll be able to forecast your spending!",
            data: null,
            charts: null,
            suggestions: [
                'Add an expense',
                'Import bank statements',
                "What's my health score?",
            ],
            severity: 'info',
            actions: [{ label: 'Add Expense', route: '/expenses' }],
        };
    }

    // ── Natural text ──
    let text = `At your current rate of **₹${dailyRate.toLocaleString('en-IN')}/day**, you're projected to spend **₹${projectedMonthEnd.toLocaleString('en-IN')}** by month-end.`;
    text += ` You have **${daysRemaining} days** remaining this month.`;

    if (weekendInsight) {
        text += ` ${weekendInsight}.`;
    }

    // ── Charts ──
    const charts = [];
    if (categoryPredictions.length > 0) {
        // Filter to relevant category if asked
        let chartData = categoryPredictions;
        if (entities.category) {
            chartData = categoryPredictions.filter(c =>
                c.category?.toLowerCase() === entities.category.toLowerCase()
            );
            if (chartData.length === 0) chartData = categoryPredictions;
        }

        charts.push({
            chartType: 'bar',
            title: 'Projected Spending by Category',
            data: chartData.slice(0, 6).map(c => ({
                name: c.category || 'other',
                spent: c.spent,
                projected: c.projected,
            })),
            dataKeys: { x: 'name', y: 'projected' },
        });
    }

    return {
        type: 'prediction',
        text,
        data: {
            totalSpent,
            dailyRate,
            projectedMonthEnd,
            daysRemaining,
            weekendMultiplier,
            categoryPredictions,
        },
        charts: charts.length > 0 ? charts : null,
        suggestions: [
            'How much did I spend this month?',
            'Am I overspending?',
            'Show my subscriptions',
        ],
        severity: null,
        actions: [{ label: 'View Analytics', route: '/analytics' }],
    };
}
