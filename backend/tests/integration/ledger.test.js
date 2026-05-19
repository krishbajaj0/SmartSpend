import mongoose from 'mongoose';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import Account from '../../models/Account.js';
import Transaction from '../../models/Transaction.js';
import { 
    createExpenseTransaction, 
    createTransferTransaction,
    deleteTransaction 
} from '../../services/transactionService.js';

import { jest } from '@jest/globals';

let replSet;

jest.setTimeout(300000); // 5 minutes for downloading/starting mongodb binaries

// Set up MongoDB Memory Server Replica Set (Transactions require Replica Sets)
beforeAll(async () => {
    replSet = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
    const uri = replSet.getUri();
    await mongoose.connect(uri);
});

afterAll(async () => {
    await mongoose.disconnect();
    if (replSet) {
        await replSet.stop();
    }
});

beforeEach(async () => {
    await Account.deleteMany({});
    await Transaction.deleteMany({});
});

describe('Ledger Integrity & Concurrency', () => {
    const userId = new mongoose.Types.ObjectId();

    // Helper: Verify Ledger Integrity
    const verifyLedgerIntegrity = async (expectedTotal) => {
        const accounts = await Account.find({ userId });
        const sum = accounts.reduce((acc, account) => acc + account.balance, 0);
        expect(sum).toBe(expectedTotal);
    };

    it('1. Concurrency: 100 simultaneous requests should result in exactly 1 transaction (Idempotency)', async () => {
        // Setup Account
        const account = await Account.create({
            userId,
            name: 'Checking',
            type: 'BANK',
            balance: 5000,
            currency: 'INR'
        });

        const idempotencyKey = `idempotent_test_123`;
        const amount = 50;

        // 100 simultaneous promises
        const requests = [...Array(100)].map(() => {
            return new Promise(async (resolve) => {
                let session = null;
                try {
                    session = await Transaction.startSession();
                    session.startTransaction();
                    
                    const tx = await createExpenseTransaction({
                        userId,
                        amount,
                        fromAccountId: account._id,
                        merchant: 'Amazon',
                        category: 'shopping',
                        idempotencyKey
                    }, session);

                    await session.commitTransaction();
                    resolve({ success: true, tx });
                } catch (err) {
                    if (session) await session.abortTransaction();
                    resolve({ success: false, err });
                } finally {
                    if (session) session.endSession();
                }
            });
        });

        await Promise.all(requests);

        // Verify Database State
        const txCount = await Transaction.countDocuments({ idempotencyKey });
        expect(txCount).toBe(1);

        const updatedAccount = await Account.findById(account._id);
        expect(updatedAccount.balance).toBe(5000 - amount); // Exactly 1 deduction

        await verifyLedgerIntegrity(4950);
    });

    it('2. Rollback Failure: Both balance unchanged and transaction absent on abort', async () => {
        const account = await Account.create({
            userId,
            name: 'Checking',
            type: 'BANK',
            balance: 5000,
            currency: 'INR'
        });

        let session = null;
        try {
            session = await Transaction.startSession();
            session.startTransaction();

            // Deliberate manual deduction without a full commit
            await Account.findOneAndUpdate(
                { _id: account._id },
                { $inc: { balance: -100 } },
                { new: true, session }
            );

            // Create partial transaction
            await Transaction.create([{
                userId,
                type: 'EXPENSE',
                amount: 100,
                fromAccountId: account._id,
            }], { session });

            // FORCE AN ERROR
            throw new Error('Forced validation failure');

        } catch (err) {
            await session.abortTransaction();
        } finally {
            if (session) session.endSession();
        }

        // Verify
        const updatedAccount = await Account.findById(account._id);
        expect(updatedAccount.balance).toBe(5000); // Balance unchanged

        const txCount = await Transaction.countDocuments({ userId });
        expect(txCount).toBe(0); // Transaction absent

        await verifyLedgerIntegrity(5000);
    });

    it('3. Overdraft Protection: Should not create transaction or leak side effects', async () => {
        const account = await Account.create({
            userId,
            name: 'Checking',
            type: 'BANK',
            balance: 100, // Very low balance
            currency: 'INR'
        });

        let session = null;
        let caughtError = null;
        try {
            session = await Transaction.startSession();
            session.startTransaction();

            await createExpenseTransaction({
                userId,
                amount: 5000, // Insufficient funds
                fromAccountId: account._id,
                merchant: 'Ferrari'
            }, session);

            await session.commitTransaction();
        } catch (err) {
            caughtError = err;
            if (session) await session.abortTransaction();
        } finally {
            if (session) session.endSession();
        }

        expect(caughtError).toBeDefined();
        expect(caughtError.message).toMatch(/Insufficient funds/i);

        const updatedAccount = await Account.findById(account._id);
        expect(updatedAccount.balance).toBe(100);

        const txCount = await Transaction.countDocuments({ userId });
        expect(txCount).toBe(0);

        await verifyLedgerIntegrity(100);
    });

    it('4. Isolation Leakage (Read Uncommitted): Session B must NOT see uncommitted balance', async () => {
        const account = await Account.create({
            userId,
            name: 'Checking',
            type: 'BANK',
            balance: 2000,
            currency: 'INR'
        });

        let sessionA = null;
        try {
            sessionA = await Transaction.startSession();
            sessionA.startTransaction();

            // Session A deducts
            await Account.findOneAndUpdate(
                { _id: account._id },
                { $inc: { balance: -500 } },
                { new: true, session: sessionA }
            );

            // Session B reads Account (without session A context)
            const sessionBRead = await Account.findById(account._id);
            expect(sessionBRead.balance).toBe(2000); // MUST see old balance because A hasn't committed!

            // Now commit A
            await sessionA.commitTransaction();

            // Read again globally
            const postCommitRead = await Account.findById(account._id);
            expect(postCommitRead.balance).toBe(1500);

        } finally {
            if (sessionA) sessionA.endSession();
        }

        await verifyLedgerIntegrity(1500);
    });

    it('5. Double Delete Protection: Duplicate simultaneous deleteTransaction calls', async () => {
        const account = await Account.create({
            userId,
            name: 'Checking',
            type: 'BANK',
            balance: 1000,
            currency: 'INR'
        });

        let setupSession = await Transaction.startSession();
        setupSession.startTransaction();
        const tx = await createExpenseTransaction({
            userId,
            amount: 200,
            fromAccountId: account._id,
        }, setupSession);
        await setupSession.commitTransaction();
        setupSession.endSession();

        // Balance should be 800 now.
        const midAccount = await Account.findById(account._id);
        expect(midAccount.balance).toBe(800);

        // Try deleting it TWICE simultaneously
        const promises = [
            (async () => {
                let s = await Transaction.startSession();
                s.startTransaction();
                try {
                    await deleteTransaction(tx._id, userId, s);
                    await s.commitTransaction();
                    return true;
                } catch(e) {
                    await s.abortTransaction();
                    return false;
                } finally {
                    s.endSession();
                }
            })(),
            (async () => {
                let s = await Transaction.startSession();
                s.startTransaction();
                try {
                    await deleteTransaction(tx._id, userId, s);
                    await s.commitTransaction();
                    return true;
                } catch(e) {
                    await s.abortTransaction();
                    return false;
                } finally {
                    s.endSession();
                }
            })()
        ];

        const results = await Promise.all(promises);

        // Expect one true, one false
        expect(results.filter(r => r === true).length).toBe(1);
        expect(results.filter(r => r === false).length).toBe(1);

        // Balance should only be rolled back ONCE (1000)
        const finalAccount = await Account.findById(account._id);
        expect(finalAccount.balance).toBe(1000);

        await verifyLedgerIntegrity(1000);
    });
});
