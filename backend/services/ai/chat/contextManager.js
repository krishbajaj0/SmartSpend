/**
 * @file services/ai/chat/contextManager.js
 *
 * Lightweight conversational context resolver.
 *
 * Uses a `conversationState` object (sent from the client) to handle follow-ups:
 *   - "What about last month?" → inherits activeIntent + activeFilters.category, overrides timeRange
 *   - "Compare with transport" → inherits activeIntent, overrides category
 *   - "Why?" / "Break it down" → inherits everything, adds detail flag
 *
 * No server-side session store. Context travels in the request body.
 */

import { parseDateRange, parseCategory } from '../queryEngine.js';

// ── Follow-up detection patterns ──
const FOLLOW_UP_PATTERNS = [
    /^(?:what|how) about/i,
    /^(?:and|also|same for|compare (?:with|to|vs))/i,
    /^(?:why|explain|break (?:it )?down|more (?:detail|info))/i,
    /^(?:show me|tell me) more/i,
];

const TIME_SHIFT_PATTERNS = [
    /(?:last|this|next) (?:week|month|year)/i,
    /(?:yesterday|today)/i,
    /(?:last \d+ (?:day|week|month)s?)/i,
];

/**
 * Resolve follow-up context by merging current entities with previous state.
 *
 * @param {string} intent        — classified intent (may be 'unknown' for follow-ups)
 * @param {object} entities      — extracted entities from current message
 * @param {object|null} convState — previous conversationState from client
 * @param {string} message       — raw user message
 * @returns {{ intent: string, entities: object, isFollowUp: boolean }}
 */
export function resolveContext(intent, entities, convState, message) {
    // No previous context → no follow-up possible
    if (!convState || !convState.activeIntent) {
        return { intent, entities, isFollowUp: false };
    }

    const lower = (message || '').toLowerCase().trim();

    // Check if this looks like a follow-up
    const isFollowUp = FOLLOW_UP_PATTERNS.some(p => p.test(lower));
    const hasTimeShift = TIME_SHIFT_PATTERNS.some(p => p.test(lower));

    // If strong new intent detected with high confidence, don't inherit
    if (intent !== 'unknown' && !isFollowUp && !hasTimeShift) {
        return { intent, entities, isFollowUp: false };
    }

    // ── Follow-up resolution ──
    const resolvedIntent = (intent === 'unknown') ? convState.activeIntent : intent;
    const resolvedEntities = { ...entities };

    // Inherit category from previous turn if not explicitly set
    if (!resolvedEntities.category && convState.activeFilters?.category) {
        // But check if user mentioned a different category
        const newCategory = parseCategory(message);
        resolvedEntities.category = newCategory || convState.activeFilters.category;
    }

    // Handle time shifts — if user says "last month" in a follow-up,
    // override timeRange but keep everything else
    if (hasTimeShift) {
        resolvedEntities.timeRange = parseDateRange(message);
    } else if (!resolvedEntities.timeRange && convState.activeFilters?.timeRange) {
        resolvedEntities.timeRange = convState.activeFilters.timeRange;
    }

    // Inherit merchant if not explicitly set
    if (!resolvedEntities.merchant && convState.activeFilters?.merchant) {
        resolvedEntities.merchant = convState.activeFilters.merchant;
    }

    return {
        intent: resolvedIntent,
        entities: resolvedEntities,
        isFollowUp: true,
    };
}

/**
 * Build a new conversationState from the current turn's results.
 *
 * @param {string} intent
 * @param {object} entities
 * @param {string} responseType
 * @returns {object} conversationState for next turn
 */
export function buildConversationState(intent, entities, responseType) {
    return {
        activeIntent: intent,
        activeFilters: {
            category: entities.category || null,
            timeRange: entities.timeRange ? {
                start: entities.timeRange.start,
                end: entities.timeRange.end,
                label: entities.timeRange.label,
            } : null,
            merchant: entities.merchant || null,
        },
        lastResponseType: responseType,
    };
}
