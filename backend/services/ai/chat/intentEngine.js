/**
 * @file services/ai/chat/intentEngine.js
 *
 * Deterministic intent classifier with weighted positive/negative scoring.
 *
 * Algorithm:
 *   1. Check greeting patterns first (short-circuit)
 *   2. Normalize input (lowercase, strip punctuation)
 *   3. For each intent:
 *      - +1 per keyword match
 *      - +3 per regex pattern match
 *      - -2 per negative keyword match
 *   4. Return highest-scoring intent if above confidence threshold
 *   5. Extract entities: category, timeRange, merchant
 *
 * Confidence = normalizedScore / maxPossibleScore for that intent
 * Threshold  = 0.15 (tuned to avoid false negatives on short queries)
 */

import { INTENTS, GREETING_PATTERNS, INTENT_VERSION } from './intents.js';
import { parseDateRange, parseCategory, parseMerchant } from '../queryEngine.js';
import constants from '../../../config/constants.js';

const POSITIVE_WEIGHT = 1;
const PATTERN_WEIGHT  = 3;
const NEGATIVE_WEIGHT = -10;
const CONFIDENCE_THRESHOLD = 0.15;

/**
 * Classify a user message into an intent.
 * @param {string} message — raw user message
 * @returns {{ intent: string, confidence: number, entities: object, intentVersion: string }}
 */
export function classifyIntent(message) {
    const lower = message.toLowerCase().trim();

    // ── Short-circuit: greeting ──
    for (const pattern of GREETING_PATTERNS) {
        if (pattern.test(lower)) {
            return {
                intent: 'greeting',
                confidence: 1.0,
                entities: {},
                intentVersion: INTENT_VERSION,
            };
        }
    }

    // ── Score each intent ──
    let bestIntent = null;
    let bestScore = -Infinity;
    let bestMaxScore = 1;

    for (const def of INTENTS) {
        // Feature flag check
        if (constants.ai.intents[def.id] === false) {
            continue;
        }

        let score = 0;

        // Positive keywords
        for (const kw of def.keywords) {
            if (lower.includes(kw)) {
                score += POSITIVE_WEIGHT;
            }
        }

        // Regex patterns (higher weight)
        for (const pattern of def.patterns) {
            if (pattern.test(lower)) {
                score += PATTERN_WEIGHT;
            }
        }

        // Negative keywords (penalize mismatches)
        for (const nkw of def.negativeKeywords) {
            if (lower.includes(nkw)) {
                score += NEGATIVE_WEIGHT;
            }
        }

        // Priority tiebreaker: add a tiny fraction so higher-priority intents win ties
        const priorityBonus = def.priority * 0.001;
        const finalScore = score + priorityBonus;

        if (finalScore > bestScore) {
            bestScore = finalScore;
            bestIntent = def;
        }
    }
    
    // console.log("INTENT SCORES FOR:", message, { bestIntent: bestIntent?.id, bestScore });

    // ── Confidence check ──
    // A score of 4+ (e.g. 1 pattern + 1 keyword) gives 1.0 confidence.
    const rawConfidence = Math.max(0, bestScore) / 4;
    const confidence = Math.min(1, Math.round(rawConfidence * 100) / 100);

    if (!bestIntent || confidence < CONFIDENCE_THRESHOLD) {
        return {
            intent: 'unknown',
            confidence: 0,
            entities: {},
            intentVersion: INTENT_VERSION,
        };
    }

    // ── Extract entities ──
    const entities = {};
    if (bestIntent.entities.includes('category')) {
        const cat = parseCategory(message);
        if (cat) entities.category = cat;
    }
    if (bestIntent.entities.includes('timeRange')) {
        entities.timeRange = parseDateRange(message);
    }
    if (bestIntent.entities.includes('merchant')) {
        const merchant = parseMerchant(message);
        if (merchant) entities.merchant = merchant;
    }

    return {
        intent: bestIntent.id,
        confidence,
        entities,
        intentVersion: bestIntent.version,
    };
}
