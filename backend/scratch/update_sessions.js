import fs from 'fs';
import path from 'path';

const files = [
    'd:/Smart Spend/backend/controllers/transactionController.js',
    'd:/Smart Spend/backend/controllers/expenseController.js',
    'd:/Smart Spend/backend/controllers/receiptController.js'
];

for (const file of files) {
    if (fs.existsSync(file)) {
        let content = fs.readFileSync(file, 'utf8');

        // Insert imports if not exists
        if (!content.includes('startTransactionIfSupported')) {
            content = "import { startTransactionIfSupported, commitTransactionIfSupported, abortTransactionIfSupported } from '../utils/session.js';\n" + content;
        }

        // Replace session logic
        content = content.replace(/session = await Transaction\.startSession\(\);\s*session\.startTransaction\(\);/g, 'session = await startTransactionIfSupported();');
        content = content.replace(/await session\.commitTransaction\(\);\s*session\.endSession\(\);/g, 'await commitTransactionIfSupported(session);');
        content = content.replace(/await session\.abortTransaction\(\);\s*session\.endSession\(\);/g, 'await abortTransactionIfSupported(session);');

        fs.writeFileSync(file, content, 'utf8');
        console.log('Updated', file);
    }
}
