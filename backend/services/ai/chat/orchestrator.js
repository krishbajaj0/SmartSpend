/**
 * @file services/ai/chat/orchestrator.js
 *
 * Thin orchestration layer — routes classified intents to handler functions.
 *
 * Design:
 *   - NO business logic lives here
 *   - Handlers are isolated per-intent modules
 *   - Orchestrator handles: classification → context → routing → timing → logging
 *   - Response time budget: 2500ms max, graceful timeout fallback
 */

import { classifyIntent } from './intentEngine.js';
import { resolveContext, buildConversationState } from './contextManager.js';
import { GREETING_RESPONSE, UNKNOWN_RESPONSE } from './intents.js';
import { handle as handleSpending } from './handlers/spendingHandler.js';
import { handle as handleHealth } from './handlers/healthHandler.js';
import { handle as handlePrediction } from './handlers/predictionHandler.js';
import { handle as handleSubscription } from './handlers/subscriptionHandler.js';
import logger from '../../../config/logger.js';
import Transaction from '../../../models/Transaction.js';
import { ACTIVE_TRANSACTION_FILTER } from '../../../config/constants.js';

const RESPONSE_BUDGET_MS = 2500;
const COLD_START_THRESHOLD = 5;

// ── Handler registry ──
// Intent ID → handler function. Adding a new intent = one import + one entry.
const HANDLERS = {
    spending_summary: handleSpending,
    health_score:     handleHealth,
    prediction:       handlePrediction,
    subscriptions:    handleSubscription,
};

/**
 * Orchestrate a single chat turn.
 *
 * @param {ObjectId} userId
 * @param {string} message — sanitized user message
 * @param {object|null} conversationState — from previous turn
 * @returns {Promise<{ response: object, conversationState: object, meta: object }>}
 */
export async function orchestrate(userId, message, conversationState = null) {
    const startTime = Date.now();

    // ── 1. Classify intent ──
    const classification = classifyIntent(message);
    const { intent: rawIntent, confidence, entities: rawEntities, intentVersion } = classification;

    // ── 2. Resolve context (follow-ups) ──
    const { intent, entities, isFollowUp } = resolveContext(
        rawIntent, rawEntities, conversationState, message
    );

    // ── 3. Handle greeting / unknown (no service call) ──
    if (intent === 'greeting') {
        const elapsed = Date.now() - startTime;
        logChatRequest(userId, intent, intentVersion, confidence, elapsed, true, isFollowUp);
        return {
            response: GREETING_RESPONSE,
            conversationState: buildConversationState(intent, {}, 'greeting'),
            meta: { intent, intentVersion, confidence, responseTimeMs: elapsed, isFollowUp, source: 'ai/chat/intents.js', generatedAt: Date.now() },
        };
    }

    if (intent === 'unknown' || !HANDLERS[intent]) {
        const elapsed = Date.now() - startTime;
        logChatRequest(userId, 'unknown', intentVersion, confidence, elapsed, false, isFollowUp);
        return {
            response: UNKNOWN_RESPONSE,
            conversationState: conversationState || buildConversationState('unknown', {}, 'unknown'),
            meta: { intent: 'unknown', intentVersion, confidence, responseTimeMs: elapsed, isFollowUp, source: 'ai/chat/intents.js', generatedAt: Date.now() },
        };
    }

    // ── 4. Cold-start check — onboarding pivot for new users ──
    const txCount = await Transaction.countDocuments(
        { userId, ...ACTIVE_TRANSACTION_FILTER },
    ).limit(COLD_START_THRESHOLD).maxTimeMS(1000);

    if (txCount < COLD_START_THRESHOLD) {
        const elapsed = Date.now() - startTime;
        logChatRequest(userId, intent, intentVersion, confidence, elapsed, true, isFollowUp);
        return {
            response: {
                type: 'onboarding',
                text: `You're just getting started! I work best once you have a few transactions logged. Try adding some expenses, income, or transfers first — then I can show you spending trends, health scores, predictions, and more.`,
                data: null,
                charts: null,
                suggestions: [
                    'Add an expense',
                    'Set up a budget',
                    'Link an account',
                    'What can you do?',
                ],
                severity: 'info',
                actions: null,
            },
            conversationState: buildConversationState('onboarding', {}, 'onboarding'),
            meta: { intent: 'onboarding', intentVersion, confidence: 1, responseTimeMs: elapsed, isFollowUp, source: 'ai/chat/orchestrator.js', generatedAt: Date.now() },
        };
    }

    // ── 5. Route to handler with timeout budget ──
    try {
        const handler = HANDLERS[intent];

        const response = await Promise.race([
            handler(userId, message, entities),
            new Promise((_, reject) =>
                setTimeout(() => reject(new Error('RESPONSE_BUDGET_EXCEEDED')), RESPONSE_BUDGET_MS)
            ),
        ]);

        const elapsed = Date.now() - startTime;
        logChatRequest(userId, intent, intentVersion, confidence, elapsed, true, isFollowUp);

        return {
            response,
            conversationState: buildConversationState(intent, entities, response.type),
            meta: { 
                intent, intentVersion, confidence, responseTimeMs: elapsed, isFollowUp, 
                source: `ai/chat/handlers/${intent}Handler.js`, 
                generatedAt: Date.now(),
                errorCode: response.type === 'error' ? 'AI_NO_DATA' : null
            },
        };
    } catch (err) {
        const elapsed = Date.now() - startTime;

        // ── Timeout fallback ──
        if (err.message === 'RESPONSE_BUDGET_EXCEEDED') {
            logger.warn({ userId: String(userId), intent, elapsed }, 'Chat response budget exceeded');
            return {
                response: {
                    type: intent,
                    text: "I'm still analyzing your data — this is taking longer than usual. Please try again in a moment.",
                    data: null,
                    charts: null,
                    suggestions: ['Try again', 'Ask something else'],
                    severity: 'warning',
                    actions: null,
                },
                conversationState: conversationState || buildConversationState(intent, entities, 'timeout'),
                meta: { intent, intentVersion, confidence, responseTimeMs: elapsed, isFollowUp, timeout: true, errorCode: 'AI_TIMEOUT', source: 'ai/chat/orchestrator.js', generatedAt: Date.now() },
            };
        }

        // ── Service error fallback ──
        logger.error({ err, userId: String(userId), intent, elapsed }, 'Chat handler error');
        return {
            response: {
                type: 'error',
                text: "I couldn't fetch your data right now. Please try again in a moment.",
                data: null,
                charts: null,
                suggestions: ['Try again', "What's my health score?", 'Show my subscriptions'],
                severity: 'danger',
                actions: null,
            },
            conversationState: conversationState || buildConversationState(intent, entities, 'error'),
            meta: { intent, intentVersion, confidence, responseTimeMs: elapsed, isFollowUp, error: true, errorCode: 'AI_SERVICE_FAILURE', source: 'ai/chat/orchestrator.js', generatedAt: Date.now() },
        };
    }
}

/**
 * Structured observability log for every chat request.
 */
function logChatRequest(userId, intent, intentVersion, confidence, responseTimeMs, success, isFollowUp) {
    logger.info({
        module: 'ai-chat',
        userId: String(userId),
        intent,
        intentVersion,
        confidence,
        responseTimeMs,
        success,
        isFollowUp,
    }, `Chat: ${intent} (${confidence}) in ${responseTimeMs}ms`);
}
