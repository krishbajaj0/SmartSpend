const fs = require('fs');
const path = require('path');

const files = [
    'services/ai/subscriptionDetector.js',
    'services/ai/recurringDetector.js',
    'services/ai/queryEngine.js',
    'services/ai/predictor.js',
    'services/ai/insightsEngine.js',
    'services/ai/healthScore.js',
    'services/ai/categorizer.js',
    'services/ai/budgetAdvisor.js',
    'services/ai/anomalyDetector.js',
    'services/notifications/budgetAlerts.js',
    'jobs/scheduler.js',
    'controllers/receiptController.js'
];

files.forEach(f => {
    const p = path.join('d:/Smart Spend/backend', f);
    if (!fs.existsSync(p)) return;
    let c = fs.readFileSync(p, 'utf8');
    
    // Replace imports
    c = c.replace(/import Expense from '..\/..\/models\/Expense.js';/g, "import Transaction from '../../models/Transaction.js';");
    c = c.replace(/import Expense from '..\/models\/Expense.js';/g, "import Transaction from '../models/Transaction.js';");
    
    // Replace finds
    c = c.replace(/Expense\.find\(\{/g, "Transaction.find({ type: 'EXPENSE', ");
    c = c.replace(/Expense\.findOne\(\{/g, "Transaction.findOne({ type: 'EXPENSE', ");
    c = c.replace(/Expense\.countDocuments\(\{/g, "Transaction.countDocuments({ type: 'EXPENSE', ");
    c = c.replace(/Expense\.updateMany\(\{/g, "Transaction.updateMany({ type: 'EXPENSE', ");
    
    // Replace aggregates
    c = c.replace(/Expense\.aggregate\(\[\s*\{\s*\$match:\s*\{/g, "Transaction.aggregate([\n        { $match: { type: 'EXPENSE', ");
    
    // Check if we need to replace raw Expense calls
    c = c.replace(/ Expense\./g, " Transaction.");
    
    fs.writeFileSync(p, c);
    console.log('Updated ' + f);
});
