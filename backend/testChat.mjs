import { classifyIntent } from './services/ai/chat/intentEngine.js';
import { resolveContext } from './services/ai/chat/contextManager.js';
import mongoose from 'mongoose';

async function test() {
    await mongoose.connect('mongodb://127.0.0.1:27017/smartspend');
    console.log('\n--- TESTING INTENT CLASSIFICATION ---');
    
    const queries = [
        "How much did I spend on food this month?",
        "What is my financial health score?",
        "Show my subscriptions",
        "Predict my spending for this month",
        "Why is my health score so low?",
        "What about last month?", // follow-up test
    ];

    let lastState = null;

    for (const q of queries) {
        console.log(`\nUser: "${q}"`);
        const { intent, confidence, entities, intentVersion } = classifyIntent(q);
        
        console.log(`  Raw Intent: ${intent} (Conf: ${confidence})`);
        console.log(`  Raw Entities:`, entities);
        
        const resolved = resolveContext(intent, entities, lastState, q);
        console.log(`  Resolved Intent: ${resolved.intent} (FollowUp: ${resolved.isFollowUp})`);
        console.log(`  Resolved Entities:`, resolved.entities);
        
        // update mock state
        lastState = {
            activeIntent: resolved.intent,
            activeFilters: {
                category: resolved.entities.category || null,
                timeRange: resolved.entities.timeRange || null
            }
        };
    }

    mongoose.disconnect();
}

test().catch(console.error);
