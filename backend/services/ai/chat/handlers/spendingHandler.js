/**
 * @file services/ai/chat/handlers/spendingHandler.js
 *
 * Handles the `spending_summary` intent by routing to queryEngine.processQuery.
 * Formats the raw query result into a structured chat response with charts.
 */

import { processQuery } from '../../queryEngine.js';

const MAX_RANGE_DAYS = 365;

/**
 * @param {ObjectId} userId
 * @param {string} message — original user message
 * @param {object} entities — { category?, timeRange?, merchant? }
 * @returns {Promise<object>} Structured response
 */
export async function handle(userId, message, entities) {
    // ── Query complexity guard ──
    if (entities.timeRange) {
        const rangeDays = Math.ceil(
            (entities.timeRange.end - entities.timeRange.start) / (1000 * 60 * 60 * 24)
        );
        if (rangeDays > MAX_RANGE_DAYS) {
            return {
                type: 'spending_summary',
                text: `That's a very wide time range (${rangeDays} days). I can handle up to 1 year. Try "How much did I spend this year?" instead.`,
                data: null,
                charts: null,
                suggestions: [
                    'How much did I spend this year?',
                    'Show my spending last month',
                    'What did I spend this month?',
                ],
                severity: 'warning',
                actions: null,
            };
        }
    }

    const result = await processQuery(userId, message);

    // ── Empty state ──
    if (result.totalSpent === 0) {
        return {
            type: 'spending_summary',
            text: result.response,
            data: { totalSpent: 0, transactionCount: 0, filters: result.filters },
            charts: null,
            suggestions: [
                entities.category ? `Try a different time range for ${entities.category}` : 'Try a different time range',
                'Import bank statements',
                'Show my predicted spending',
            ],
            severity: 'info',
            actions: [{ label: 'Add Expense', route: '/expenses' }],
        };
    }

    // ── Build charts ──
    const charts = [];
    if (result.topCategories && result.topCategories.length > 0) {
        charts.push({
            chartType: 'bar',
            title: `Spending by Category (${result.filters.dateRange.label})`,
            data: result.topCategories.map(c => ({
                name: c.category || 'other',
                value: c.total,
            })),
            dataKeys: { x: 'name', y: 'value' },
        });
    }

    // ── Suggestions ──
    const suggestions = [];
    if (entities.category) {
        suggestions.push(`Compare ${entities.category} with last month`);
    } else {
        suggestions.push('Break down by category');
    }
    suggestions.push('Show my predicted spending', 'Any unusual expenses?');

    return {
        type: 'spending_summary',
        text: result.response,
        data: {
            totalSpent: result.totalSpent,
            transactionCount: result.transactionCount,
            avgAmount: result.avgAmount,
            filters: result.filters,
            topCategories: result.topCategories,
        },
        charts: charts.length > 0 ? charts : null,
        suggestions,
        severity: null,
        actions: [{ label: 'View Expenses', route: '/expenses' }],
    };
}
