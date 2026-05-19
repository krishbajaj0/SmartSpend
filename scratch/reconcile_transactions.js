import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Transaction from './backend/models/Transaction.js';
import Expense from './backend/models/Expense.js';

dotenv.config({ path: './backend/.env' });

async function reconcile() {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('Connected to MongoDB');

        const userId = '67ba6036f0a4025d506d15b0'; // Assuming this is the user based on context or we can find by email
        
        // 1. Get all transactions of type EXPENSE for this user
        const transactions = await Transaction.find({ userId, type: 'EXPENSE' });
        console.log(`Found ${transactions.length} expense transactions`);

        // 2. Get all non-deleted expenses for this user
        const expenses = await Expense.find({ userId, isDeleted: false });
        const validTxIds = new Set(expenses.map(e => e.transactionId?.toString()).filter(id => id));

        // 3. Find orphans
        const orphans = transactions.filter(tx => !validTxIds.has(tx._id.toString()));
        console.log(`Found ${orphans.length} orphaned transactions`);

        if (orphans.length > 0) {
            const idsToDelete = orphans.map(tx => tx._id);
            await Transaction.deleteMany({ _id: { $in: idsToDelete } });
            console.log(`Successfully deleted ${orphans.length} orphaned transactions`);
        }

        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}

reconcile();
