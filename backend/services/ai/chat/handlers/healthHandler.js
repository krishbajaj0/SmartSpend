/**
 * @file services/ai/chat/handlers/healthHandler.js
 *
 * Handles the `health_score` intent by routing to healthScore.calculateHealthScore.
 * Formats score, grade, breakdown, and tips into a rich structured response.
 */

import { calculateHealthScore } from '../../healthScore.js';

/**
 * @param {ObjectId} userId
 * @param {string} message
 * @param {object} entities
 * @returns {Promise<object>} Structured response
 */
export async function handle(userId, _message, _entities) {
    const result = await calculateHealthScore(userId);
    const { score, grade, breakdown, tips } = result;

    // ── Severity based on score ──
    let severity = 'success';
    if (score < 40) severity = 'danger';
    else if (score < 70) severity = 'warning';

    // ── Generate natural text ──
    let text = `Your Financial Health Score is **${score}/100** (Grade: **${grade}**).`;
    if (score >= 80) {
        text += " Excellent! You're managing your finances very well. 🎉";
    } else if (score >= 60) {
        text += " Good overall, but there's room for improvement.";
    } else if (score >= 40) {
        text += ' Your finances need some attention. Check the tips below.';
    } else {
        text += ' Your financial health needs immediate attention. Follow the tips below to improve.';
    }

    // ── Charts ──
    const charts = [
        {
            chartType: 'progress',
            title: 'Health Score',
            data: [{ name: 'Score', value: score, max: 100 }],
            dataKeys: { x: 'name', y: 'value' },
        },
        {
            chartType: 'bar',
            title: 'Score Breakdown',
            data: breakdown.map(b => ({
                name: b.factor.replace(/\s+/g, '\n'),
                value: b.score,
                weight: b.weight,
            })),
            dataKeys: { x: 'name', y: 'value' },
        },
    ];

    // ── Suggestions from tips ──
    const suggestions = tips.map(t => t.message).slice(0, 3);
    if (suggestions.length === 0) {
        suggestions.push('Show my spending this month', 'Predict my spending');
    }

    return {
        type: 'health_score',
        text,
        data: { score, grade, breakdown, tips },
        charts,
        suggestions,
        severity,
        actions: [
            { label: 'View Budgets', route: '/budgets' },
            { label: 'View Analytics', route: '/analytics' },
        ],
    };
}
