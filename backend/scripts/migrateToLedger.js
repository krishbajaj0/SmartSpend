import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import Expense from '../models/Expense.js';
import Transaction from '../models/Transaction.js';
import Account from '../models/Account.js';

// Setup env
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '../.env') });

async function migrateToLedger() {
    console.log('🔄 Starting Ledger Unification Migration...');
    
    if (!process.env.MONGO_URI) {
        console.error('❌ MONGO_URI is not set in environment variables');
        process.exit(1);
    }

    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log('✅ Connected to MongoDB');

        // 1. Get total count
        const totalExpenses = await Expense.countDocuments();
        console.log(`📊 Found ${totalExpenses} expenses to migrate`);

        if (totalExpenses === 0) {
            console.log('✅ No expenses to migrate. Exiting.');
            process.exit(0);
        }

        // 2. Identify users that need default accounts
        console.log('🔍 Identifying users and setting up System Accounts...');
        const userIdsWithExpenses = await Expense.distinct('userId');
        
        const defaultAccountMap = {}; // userId -> accountId
        
        for (const userId of userIdsWithExpenses) {
            // Check if they already have the migrated balance account
            let sysAccount = await Account.findOne({
                userId,
                type: 'WALLET', // Use a standard type since SYSTEM might not be in enum
                name: 'Migrated Balance',
            });

            if (!sysAccount) {
                sysAccount = await Account.create({
                    userId,
                    name: 'Migrated Balance',
                    type: 'WALLET',
                    balance: 0,
                    currency: 'INR',
                    isDefault: false,
                });
            }
            defaultAccountMap[userId.toString()] = sysAccount._id;
        }
        console.log(`✅ Set up default accounts for ${userIdsWithExpenses.length} users`);

        // 3. Perform Migration
        console.log('🚀 Beginning migration via cursor...');
        const cursor = Expense.find().cursor();
        let migratedCount = 0;
        let skippedCount = 0;

        for (let exp = await cursor.next(); exp != null; exp = await cursor.next()) {
            // Idempotency: use _id + timestamp
            const idempotencyKey = `mig_expense_${exp._id}_${exp.updatedAt?.getTime() || Date.now()}`;

            // Check existence
            const exists = await Transaction.findOne({ idempotencyKey });
            if (exists) {
                skippedCount++;
                continue;
            }

            // Currency Consistency Check
            const baseAmount = exp.baseAmount || (exp.amount * (exp.exchangeRate || 1));

            const transactionData = {
                userId: exp.userId,
                idempotencyKey,
                type: 'EXPENSE',
                amount: exp.amount,
                currency: exp.currency || 'INR',
                baseAmount,
                exchangeRate: exp.exchangeRate || 1,
                
                fromAccountId: defaultAccountMap[exp.userId.toString()],
                toAccountId: null,

                category: exp.category || 'other',
                subCategory: exp.subCategory || '',
                merchant: exp.merchant || '',
                merchantNormalized: exp.merchantNormalized || exp.merchant?.toLowerCase() || '',
                note: exp.notes || '',
                date: exp.date || Date.now(),
                tags: exp.tags || [],

                receiptUrl: exp.receiptUrl || '',
                receiptOcrData: exp.receiptOcrData || '',
                importBatchId: exp.importBatchId,
                sourceHash: exp.sourceHash,
                sourceRow: exp.sourceRow,

                isRecurring: exp.isRecurring || false,
                recurringInterval: exp.recurringInterval || '',
                nextRecurrenceDate: exp.nextRecurrenceDate,
                
                aiCategorized: exp.aiCategorized || false,
                aiConfidence: exp.aiConfidence || 0,
                location: exp.location,

                isDeleted: exp.isDeleted || false,
                deletedAt: exp.deletedAt || null,
            };

            await Transaction.create(transactionData);
            migratedCount++;

            if (migratedCount % 100 === 0) {
                console.log(`   ... migrated ${migratedCount} / ${totalExpenses} records`);
            }
        }

        console.log(`✅ Migration complete. Migrated: ${migratedCount}, Skipped: ${skippedCount}`);

        // 4. Verification
        console.log('\n🧪 Running Data Verification...');
        
        const oldSumAggr = await Expense.aggregate([
            { $group: { _id: null, total: { $sum: '$amount' } } }
        ]);
        const oldSum = oldSumAggr[0]?.total || 0;

        const newSumAggr = await Transaction.aggregate([
            { $match: { type: 'EXPENSE', idempotencyKey: { $regex: /^mig_expense_/ } } },
            { $group: { _id: null, total: { $sum: '$amount' } } }
        ]);
        const newSum = newSumAggr[0]?.total || 0;

        console.log(`   Old Expense Total: ${oldSum}`);
        console.log(`   New Ledger Total : ${newSum}`);
        
        if (Math.abs(oldSum - newSum) < 0.01) {
            console.log('   ✅ Total amounts match perfectly.');
        } else {
            console.warn('   ⚠️ WARNING: Total amounts DO NOT match!');
        }

        console.log('\n🧪 Verifying Categories...');
        const oldCats = await Expense.aggregate([
            { $group: { _id: '$category', total: { $sum: '$amount' } } },
            { $sort: { _id: 1 } }
        ]);
        
        const newCats = await Transaction.aggregate([
            { $match: { type: 'EXPENSE', idempotencyKey: { $regex: /^mig_expense_/ } } },
            { $group: { _id: '$category', total: { $sum: '$amount' } } },
            { $sort: { _id: 1 } }
        ]);

        let catsMatch = true;
        for (let i = 0; i < oldCats.length; i++) {
            const oldC = oldCats[i];
            const newC = newCats.find(c => c._id === oldC._id);
            if (!newC || Math.abs(oldC.total - newC.total) > 0.01) {
                console.error(`   ❌ Category mismatch [${oldC._id}]: Old=${oldC.total}, New=${newC?.total || 0}`);
                catsMatch = false;
            }
        }
        
        if (catsMatch) {
            console.log('   ✅ Category totals match perfectly.');
        }

        console.log('\n🎉 Migration process finished successfully.');
        process.exit(0);

    } catch (error) {
        console.error('❌ Migration failed:', error);
        process.exit(1);
    }
}

migrateToLedger();
