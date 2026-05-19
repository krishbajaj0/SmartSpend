/**
 * @file services/ai/chat/intents.js
 *
 * Intent definitions for the AI Chat Assistant.
 *
 * Each intent has:
 *   - id:              Unique identifier
 *   - version:         Tracks classifier evolution for observability
 *   - keywords:        Positive-weight keywords (+1 each)
 *   - negativeKeywords: Negative-weight keywords (-2 each) — prevents intent collision
 *   - patterns:        Regex patterns (+3 each) — higher confidence than keywords
 *   - entities:        Which entities are relevant (category, timeRange, merchant)
 *   - service:         Which AI service to route to
 *   - priority:        Tiebreaker when two intents score equally
 */

export const INTENT_VERSION = 'v1.0';

export const INTENTS = [
    {
        id: 'spending_summary',
        version: INTENT_VERSION,
        keywords: [
            'spent', 'spend', 'spending', 'how much', 'total', 'expenses',
            'expense', 'biggest', 'largest', 'top', 'highest', 'cost',
            'money', 'paid', 'payment', 'bought', 'purchase',
        ],
        negativeKeywords: [
            'predict', 'forecast', 'will spend', 'going to spend',
            'subscription', 'recurring', 'health', 'score', 'grade',
        ],
        patterns: [
            /how much (?:did i|have i|i) (?:spent?|spending)/i,
            /(?:total|show|what(?:'s| is| are| were)) (?:my )?(?:spend|expense)/i,
            /(?:biggest|largest|top|highest|most expensive) (?:expense|spend|transaction)/i,
            /(?:where|what) (?:did|do|is) (?:my |i )?(?:money|spend)/i,
        ],
        entities: ['category', 'timeRange', 'merchant'],
        service: 'queryEngine',
        priority: 10,
    },

    {
        id: 'health_score',
        version: INTENT_VERSION,
        keywords: [
            'health', 'score', 'grade', 'financial health', 'rating',
            'doing financially', 'financial shape', 'financial status',
        ],
        negativeKeywords: [
            'spent', 'predict', 'prediction', 'forecast', 'projected',
            'subscription', 'recurring', 'medical', 'hospital', 'doctor', 
            'gym', 'fitness',
        ],
        patterns: [
            /(?:health|financial)\s*score/i,
            /(?:why|how).*(?:score|grade).*(?:decrease|drop|low|change|improve)/i,
            /how (?:am i|is my) (?:doing )?(?:financially|financial)/i,
            /(?:my|what(?:'s| is)) .*(?:financial )?(?:health|grade|rating)/i,
        ],
        entities: [],
        service: 'healthScore',
        priority: 8,
    },

    {
        id: 'prediction',
        version: INTENT_VERSION,
        keywords: [
            'predict', 'prediction', 'forecast', 'projected', 'projection',
            'will spend', 'going to spend', 'end of month', 'estimate',
            'expected', 'likely', 'remaining',
        ],
        negativeKeywords: [
            'subscription', 'recurring', 'health', 'score', 'grade',
            'how much did', 'spent last',
        ],
        patterns: [
            /(?:predict|forecast|project).*(?:spend|expense)/i,
            /(?:will|going to|expected to) (?:i )?spend/i,
            /(?:month|week) (?:end )?(?:estimate|projection|forecast)/i,
            /(?:how much|what) (?:will|would|might) (?:i )?spend/i,
            /(?:at this rate|at my current)/i,
        ],
        entities: ['category', 'timeRange'],
        service: 'predictor',
        priority: 7,
    },

    {
        id: 'subscriptions',
        version: INTENT_VERSION,
        keywords: [
            'subscription', 'subscriptions', 'recurring', 'renewal',
            'monthly payment', 'auto-pay', 'auto pay', 'repeat',
            'regular payment', 'fixed payment', 'recharge',
        ],
        negativeKeywords: [
            'predict', 'health', 'score', 'grade', 'how much',
            'biggest', 'total',
        ],
        patterns: [
            /(?:show|list|what(?:'s| are| is)) (?:my )?(?:subscription|recurring)/i,
            /(?:recurring|repeat|monthly|auto) (?:payment|charge|expense|debit)/i,
            /(?:where|what) (?:am i|do i) (?:paying|subscribed)/i,
        ],
        entities: [],
        service: 'subscriptionDetector',
        priority: 6,
    },
];

// ── Greeting intent (no service call) ──
export const GREETING_PATTERNS = [
    /^(?:hi|hello|hey|sup|yo|howdy|greetings?)(?:\s|!|\?|$)/i,
    /^(?:help|what can you do|how do you work)/i,
    /^(?:good (?:morning|afternoon|evening))/i,
];

export const GREETING_RESPONSE = {
    type: 'greeting',
    text: "Hey! 👋 I'm your SmartSpend financial assistant. I can help you understand your spending, track subscriptions, predict future expenses, and monitor your financial health.",
    data: null,
    charts: null,
    suggestions: [
        'How much did I spend this month?',
        "What's my financial health score?",
        'Show my subscriptions',
        'Predict my spending this month',
    ],
    severity: null,
    actions: null,
};

export const UNKNOWN_RESPONSE = {
    type: 'unknown',
    text: "I'm not completely sure how to help with that. But I can analyze your spending, check your financial health, predict future expenses, or list your subscriptions. What would you like to do?",
    data: null,
    charts: null,
    suggestions: [
        '📊 Check my financial health',
        '💰 Show my spending this month',
        '📈 Predict my spending',
        '🔄 Show my subscriptions',
    ],
    severity: 'info',
    actions: null,
};
