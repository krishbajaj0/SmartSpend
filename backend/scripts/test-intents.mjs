/**
 * @file scripts/test-intents.mjs
 * 
 * Intent Regression Suite
 * Tests deterministic intent classification against expected outputs.
 * Helps prevent classifier degradation when tuning regex or adding intents.
 */

import { classifyIntent } from '../services/ai/chat/intentEngine.js';

const TEST_CASES = [
    // ── spending_summary ──
    { query: "How much did I spend this month?", expected: "spending_summary" },
    { query: "total expenses for last week", expected: "spending_summary" },
    { query: "what's my biggest expense", expected: "spending_summary" },
    { query: "how much have i spent on food", expected: "spending_summary" },
    { query: "show me what I spent at amazon", expected: "spending_summary" },
    
    // ── health_score ──
    { query: "what is my financial health score?", expected: "health_score" },
    { query: "how am I doing financially?", expected: "health_score" },
    { query: "why did my score drop?", expected: "health_score" },
    { query: "what's my financial grade", expected: "health_score" },
    { query: "financial health rating", expected: "health_score" },

    // ── prediction ──
    { query: "predict my spending for next month", expected: "prediction" },
    { query: "how much will I spend by month end?", expected: "prediction" },
    { query: "what is my projected expense", expected: "prediction" },
    { query: "forecast my expenses", expected: "prediction" },
    { query: "estimate my remaining spend", expected: "prediction" },

    // ── subscriptions ──
    { query: "show my subscriptions", expected: "subscriptions" },
    { query: "what are my recurring payments", expected: "subscriptions" },
    { query: "list all monthly payments", expected: "subscriptions" },
    { query: "where am I subscribed?", expected: "subscriptions" },
    { query: "auto-pay charges", expected: "subscriptions" },

    // ── greeting ──
    { query: "hi", expected: "greeting" },
    { query: "hello", expected: "greeting" },
    { query: "help", expected: "greeting" },
    { query: "what can you do?", expected: "greeting" },

    // ── unknown (negatives or junk) ──
    { query: "asdfghjkl", expected: "unknown" },
    { query: "can you tell me a joke?", expected: "unknown" },
    
    // ── negative scoring edge cases ──
    // "predict my health score" -> prediction wants "predict", health_score wants "health score"
    // prediction has "health" & "score" as negative keywords.
    // health_score has "predict" as negative keyword.
    // Thus both should be heavily penalized, resulting in 'unknown'
    { query: "predict my health score", expected: "unknown" },
    
    // "did I spend more on subscriptions" -> spending vs subscriptions.
    { query: "did I spend more on subscriptions", expected: "subscriptions" }, 
];

console.log("🧪 Running Intent Regression Suite...");
let passed = 0;
let failed = 0;

for (const { query, expected } of TEST_CASES) {
    const result = classifyIntent(query);
    if (result.intent === expected) {
        passed++;
    } else {
        console.error(`❌ FAILED: "${query}"`);
        console.error(`   Expected: ${expected}`);
        console.error(`   Got:      `, result);
        failed++;
    }
}

console.log(`\n📊 Results: ${passed}/${TEST_CASES.length} passed.`);

if (failed > 0) {
    console.error(`\n🚨 ${failed} tests failed! Classifier has degraded.`);
    process.exit(1);
} else {
    console.log("\n✅ All tests passed! Classifier is stable.");
    process.exit(0);
}
