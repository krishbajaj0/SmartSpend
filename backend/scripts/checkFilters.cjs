const fs = require('fs');
const path = require('path');

const files = [
    'routes/dashboard.js',
    'controllers/analyticsController.js',
    'controllers/budgetController.js',
    'services/analyticsService.js',
    'services/ai/healthScore.js',
    'services/ai/budgetAdvisor.js',
    'services/ai/categorizer.js',
    'services/ai/insightsEngine.js',
    'services/ai/predictor.js',
    'services/ai/queryEngine.js',
    'services/ai/recurringDetector.js',
    'services/ai/subscriptionDetector.js',
    'services/ai/anomalyDetector.js',
    'services/notifications/budgetAlerts.js',
    'jobs/scheduler.js'
];

files.forEach(f => {
    const p = path.join('d:/Smart Spend/backend', f);
    if (!fs.existsSync(p)) return;
    let c = fs.readFileSync(p, 'utf8');
    
    // Check missing type
    const findCalls = c.match(/Transaction\.find\(\{([^\}]+)\}/g) || [];
    findCalls.forEach(call => {
        if (!call.includes('type:')) {
            console.log(`[!] Missing type in ${f}: ${call}`);
        }
        if (!call.includes('isDeleted:')) {
            console.log(`[!] Missing isDeleted in ${f}: ${call}`);
        }
    });

    const aggCalls = c.match(/Transaction\.aggregate\(\[\s*\{\s*\$match:\s*\{([^\}]+)\}/g) || [];
    aggCalls.forEach(call => {
        if (!call.includes('type:')) {
            console.log(`[!] Missing type in agg in ${f}: ${call}`);
        }
        if (!call.includes('isDeleted:')) {
            console.log(`[!] Missing isDeleted in agg in ${f}: ${call}`);
        }
    });
});
