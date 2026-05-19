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
    
    // Fix missing type and isDeleted in find
    c = c.replace(/Transaction\.find\(\{ userId, date: \{ \$gte: thirtyDaysAgo \} \}\)/g, "Transaction.find({ userId, type: 'EXPENSE', isDeleted: false, date: { $gte: thirtyDaysAgo } })");
    
    // Fix missing isDeleted in aggregate matches
    c = c.replace(/type:\s*'EXPENSE',/g, "type: 'EXPENSE', isDeleted: false,");
    c = c.replace(/type:\s*'INCOME',/g, "type: 'INCOME', isDeleted: false,");

    fs.writeFileSync(p, c);
    console.log(`Fixed ${f}`);
});
