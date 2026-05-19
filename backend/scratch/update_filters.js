import fs from 'fs';
import path from 'path';

const files = [
    'd:/Smart Spend/backend/controllers/expenseController.js',
    'd:/Smart Spend/backend/controllers/analyticsController.js',
    'd:/Smart Spend/backend/services/analyticsService.js',
    'd:/Smart Spend/backend/controllers/budgetController.js',
    'd:/Smart Spend/backend/services/ai/anomalyDetector.js',
    'd:/Smart Spend/backend/services/ai/budgetAdvisor.js',
    'd:/Smart Spend/backend/services/ai/categorizer.js',
    'd:/Smart Spend/backend/services/ai/healthScore.js',
    'd:/Smart Spend/backend/services/ai/insightsEngine.js',
    'd:/Smart Spend/backend/services/ai/predictor.js',
    'd:/Smart Spend/backend/services/ai/queryEngine.js',
    'd:/Smart Spend/backend/jobs/scheduler.js'
];

for (const file of files) {
    if (fs.existsSync(file)) {
        let content = fs.readFileSync(file, 'utf8');
        
        // Skip if already imported
        if (!content.includes('ACTIVE_TRANSACTION_FILTER')) {
            // Find where to import
            const importStatement = "import { ACTIVE_TRANSACTION_FILTER } from '../config/constants.js';\n";
            // For files deeper, we need more '../'
            const depth = file.split('backend/')[1].split('/').length - 1;
            const prefix = '../'.repeat(depth);
            const importStr = `import { ACTIVE_TRANSACTION_FILTER } from '${prefix}config/constants.js';\n`;
            
            // Add import after other imports
            content = content.replace(/(import .*;\n)+/, match => match + importStr);
        }

        // Replace isDeleted: false
        content = content.replace(/isDeleted:\s*false/g, '...ACTIVE_TRANSACTION_FILTER');
        
        fs.writeFileSync(file, content, 'utf8');
        console.log('Updated', file);
    }
}
