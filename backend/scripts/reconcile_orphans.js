import mongoose from 'mongoose';
import 'dotenv/config';
import Transaction from '../models/Transaction.js';
import Expense from '../models/Expense.js';

async function reconcile() {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log('Connected to MongoDB');

        const userId = '69ef7999f405bdaa2c420f86';
        
        // 1. Get all transactions of type EXPENSE for this user
        const transactions = await Transaction.find({ userId, type: 'EXPENSE' });
        console.log(`Found ${transactions.length} expense transactions in ledger`);

        // 2. Get all non-deleted expenses for this user
        const expenses = await Expense.find({ userId, isDeleted: false });
        const validTxIds = new Set(expenses.map(e => e.transactionId?.toString()).filter(id => id));
        console.log(`Found ${expenses.length} active metadata expenses`);

        // 3. Find orphans (Ledger entries that have no active metadata)
        const orphans = transactions.filter(tx => !validTxIds.has(tx._id.toString()));
        console.log(`Found ${orphans.length} orphaned transactions to purge`);

        if (orphans.length > 0) {
            const idsToDelete = orphans.map(tx => tx._id);
            const result = await Transaction.deleteMany({ _id: { $in: idsToDelete } });
            console.log(`Successfully deleted ${result.deletedCount} orphaned ledger records`);
        }

        console.log('Dashboard should now be clean.');
        process.exit(0);
    } catch (err) {
        console.error('Reconcile failed:', err);
        process.exit(1);
    }
}

reconcile();
