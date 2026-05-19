/**
 * @file services/ai/chat/handlers/subscriptionHandler.js
 *
 * Handles the `subscriptions` intent by routing to subscriptionDetector.detectSubscriptions.
 * Formats detected subscriptions with monthly totals and next-charge dates.
 */

import { detectSubscriptions } from '../../subscriptionDetector.js';

/**
 * @param {ObjectId} userId
 * @param {string} message
 * @param {object} entities
 * @returns {Promise<object>} Structured response
 */
export async function handle(userId, _message, _entities) {
    const subscriptions = await detectSubscriptions(userId);

    // ── Empty state ──
    if (subscriptions.length === 0) {
        return {
            type: 'subscriptions',
            text: "I couldn't detect any recurring subscriptions yet. I need at least 2 months of transaction history to identify recurring payments. Keep tracking your expenses!",
            data: null,
            charts: null,
            suggestions: [
                'Track expenses for a few more weeks',
                'Import bank statements',
                'How much did I spend this month?',
            ],
            severity: 'info',
            actions: [{ label: 'Import Transactions', route: '/import' }],
        };
    }

    // ── Compute totals ──
    const monthlyTotal = subscriptions
        .filter(s => s.interval === 'monthly')
        .reduce((sum, s) => sum + s.amount, 0);

    const totalAnnualized = subscriptions.reduce((sum, s) => {
        if (s.interval === 'monthly') return sum + s.amount * 12;
        if (s.interval === 'weekly') return sum + s.amount * 52;
        if (s.interval === 'quarterly') return sum + s.amount * 4;
        if (s.interval === 'yearly') return sum + s.amount;
        return sum;
    }, 0);

    // ── Text ──
    let text = `I detected **${subscriptions.length} recurring payment${subscriptions.length > 1 ? 's' : ''}**.`;
    if (monthlyTotal > 0) {
        text += ` Your monthly subscriptions total **₹${monthlyTotal.toLocaleString('en-IN')}**.`;
    }
    text += ` Annualized, you're spending approximately **₹${Math.round(totalAnnualized).toLocaleString('en-IN')}/year** on recurring payments.`;

    // ── Charts ──
    const charts = [{
        chartType: 'bar',
        title: 'Recurring Payments',
        data: subscriptions.slice(0, 8).map(s => ({
            name: s.merchant || s.merchantNormalized || 'Unknown',
            value: s.amount,
            interval: s.interval,
        })),
        dataKeys: { x: 'name', y: 'value' },
    }];

    // ── Build subscription list for data ──
    const subList = subscriptions.map(s => ({
        merchant: s.merchant || s.merchantNormalized,
        amount: s.amount,
        interval: s.interval,
        category: s.category,
        confidence: Math.round(s.confidence * 100),
        nextExpected: s.nextExpectedDate,
    }));

    return {
        type: 'subscriptions',
        text,
        data: {
            subscriptions: subList,
            monthlyTotal,
            annualizedTotal: Math.round(totalAnnualized),
            count: subscriptions.length,
        },
        charts,
        suggestions: [
            'How much did I spend this month?',
            "What's my health score?",
            'Predict my spending',
        ],
        severity: monthlyTotal > 5000 ? 'warning' : null,
        actions: [{ label: 'View Expenses', route: '/expenses' }],
    };
}
