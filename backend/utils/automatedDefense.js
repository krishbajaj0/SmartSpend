import ControlFlag from '../models/ControlFlag.js';
import logger from '../config/logger.js';

const WINDOWS = new Map();
const TOGGLES = new Map();
const WINDOW_SIZE = 100;

const RULES = {
    analytics_latency: {
        feature: 'analytics',
        key: 'DEGRADATION_LEVEL',
        enterMs: Number(process.env.ANALYTICS_DEGRADE_ENTER_MS || 2000),
        exitMs: Number(process.env.ANALYTICS_DEGRADE_EXIT_MS || 1500),
        minSamples: Number(process.env.ANALYTICS_DEGRADE_MIN_SAMPLES || 20),
        minHoldMs: Number(process.env.ANALYTICS_DEGRADE_MIN_HOLD_MS || 10 * 60 * 1000),
        cooldownMs: Number(process.env.ANALYTICS_DEGRADE_COOLDOWN_MS || 15 * 60 * 1000),
        enterValue: 'L1',
    },
};

function percentile(values, p) {
    if (values.length === 0) return 0;
    const sorted = [...values].sort((a, b) => a - b);
    return sorted[Math.max(0, Math.ceil((p / 100) * sorted.length) - 1)];
}

function pushWindow(key, value) {
    const values = WINDOWS.get(key) || [];
    values.push(value);
    if (values.length > WINDOW_SIZE) values.splice(0, values.length - WINDOW_SIZE);
    WINDOWS.set(key, values);
    return values;
}

async function setFeatureFlag(rule, enabled, value, reason) {
    if (enabled) {
        await ControlFlag.findOneAndUpdate(
            { key: rule.key, scopeType: 'feature', scopeId: rule.feature },
            { $set: { value, reason, updatedBy: 'automated-defense' }, $inc: { version: 1 } },
            { upsert: true, new: true, setDefaultsOnInsert: true }
        );
    } else {
        await ControlFlag.deleteOne({ key: rule.key, scopeType: 'feature', scopeId: rule.feature });
    }
}

async function evaluateLatencyRule(ruleKey, values) {
    const rule = RULES[ruleKey];
    if (!rule || values.length < rule.minSamples) return;

    const p95 = percentile(values, 95);
    const now = Date.now();
    const state = TOGGLES.get(ruleKey) || { active: false, changedAt: 0, cooldownUntil: 0 };

    if (!state.active && now >= state.cooldownUntil && p95 > rule.enterMs) {
        await setFeatureFlag(rule, true, rule.enterValue, `auto: p95 ${p95}ms > ${rule.enterMs}ms`);
        TOGGLES.set(ruleKey, { active: true, changedAt: now, cooldownUntil: now + rule.cooldownMs });
        logger.warn({ ruleKey, p95 }, 'Automated defense entered degraded mode');
        return;
    }

    if (state.active && now - state.changedAt >= rule.minHoldMs && p95 < rule.exitMs) {
        await setFeatureFlag(rule, false, null, `auto: p95 ${p95}ms < ${rule.exitMs}ms`);
        TOGGLES.set(ruleKey, { active: false, changedAt: now, cooldownUntil: now + rule.cooldownMs });
        logger.info({ ruleKey, p95 }, 'Automated defense exited degraded mode');
    }
}

export function recordOperationalSignal({ route, status, durationMs }) {
    if (route?.startsWith('/api/analytics') && status < 500) {
        const values = pushWindow('analytics_latency', durationMs);
        evaluateLatencyRule('analytics_latency', values).catch(err => {
            logger.error({ err }, 'Automated defense evaluation failed');
        });
    }
}
