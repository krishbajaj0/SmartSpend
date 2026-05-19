import mongoose from 'mongoose';
import Transaction from '../models/Transaction.js';
import Account from '../models/Account.js';
import { AppError } from '../middleware/errorHandler.js';

/**
 * Gets or creates the default fallback account for migrated/imported records.
 */
export async function getOrCreateMigratedBalanceAccount(userId, session = null) {
    let account = await Account.findOne({ userId, name: 'Migrated Balance', isDeleted: false }).session(session);
    if (!account) {
        // Create it atomically
        account = await Account.create([{
            userId,
            name: 'Migrated Balance',
            type: 'WALLET',
            balance: 0,
            currency: 'INR',
        }], { session }).then(res => res[0]);
    }
    return account._id;
}

/**
 * Creates an expense transaction and atomically deducts the balance.
 */
export async function createExpenseTransaction({ userId, amount, fromAccountId, merchant, category, note, date, idempotencyKey }, session = null) {
    if (!fromAccountId) throw new AppError('Account is required for expense', 400);

    // If idempotencyKey is provided, check for existing
    if (idempotencyKey) {
        const existing = await Transaction.findOne({ idempotencyKey, userId }).session(session);
        if (existing) return existing; // Safe return on duplicate
    }

    const account = await Account.findOne({ _id: fromAccountId, userId }).session(session);
    if (!account) throw new AppError('Account not found', 404);
    if (account.isDeleted) throw new AppError('Cannot create transaction in a deleted account', 400);

    let updateQuery;

    if (account.type === 'CREDIT_CARD') {
        // Credit Card: absolute balance + amount must not exceed credit limit
        updateQuery = {
            _id: account._id,
            $expr: {
                $lte: [
                    { $add: [{ $abs: '$balance' }, amount] },
                    '$creditLimit'
                ]
            }
        };
    } else {
        // Wallet/Bank: balance - amount must be >= 0
        updateQuery = {
            _id: account._id,
            balance: { $gte: amount }
        };
    }

    // Attempt to deduct using atomic findOneAndUpdate
    const updatedAccount = await Account.findOneAndUpdate(
        updateQuery,
        { $inc: { balance: -amount } },
        { new: true, session }
    );

    if (!updatedAccount) {
        if (account.type === 'CREDIT_CARD') {
            throw new AppError('Transaction declined: Credit limit exceeded', 400);
        } else {
            throw new AppError('Transaction declined: Insufficient funds', 400);
        }
    }

    // Insert the ledger entry
    const transaction = await Transaction.create([{
        userId,
        idempotencyKey,
        type: 'EXPENSE',
        amount,
        fromAccountId,
        toAccountId: null,
        merchant,
        category,
        note,
        date: date || new Date(),
    }], { session }).then(res => res[0]);

    return transaction;
}

/**
 * Creates an income transaction and atomically increments the balance.
 */
export async function createIncomeTransaction({ userId, amount, toAccountId, category, note, date, idempotencyKey }, session = null) {
    if (!toAccountId) throw new AppError('Account is required for income', 400);

    if (idempotencyKey) {
        const existing = await Transaction.findOne({ idempotencyKey, userId }).session(session);
        if (existing) return existing;
    }

    const account = await Account.findOne({ _id: toAccountId, userId }).session(session);
    if (!account) throw new AppError('Account not found', 404);
    if (account.isDeleted) throw new AppError('Cannot create transaction in a deleted account', 400);

    const updatedAccount = await Account.findOneAndUpdate(
        { _id: toAccountId, userId, isDeleted: false },
        { $inc: { balance: amount } },
        { new: true, session }
    );

    if (!updatedAccount) throw new AppError('Account not found or deleted', 404);

    const transaction = await Transaction.create([{
        userId,
        idempotencyKey,
        type: 'INCOME',
        amount,
        fromAccountId: null,
        toAccountId,
        category,
        note,
        date: date || new Date(),
    }], { session }).then(res => res[0]);

    return transaction;
}

/**
 * Creates a transfer transaction securely using a 2-phase safety net.
 */
export async function createTransferTransaction({ userId, amount, fromAccountId, toAccountId, note, date, idempotencyKey }, session = null) {
    if (fromAccountId.toString() === toAccountId.toString()) {
        throw new AppError('Cannot transfer to the same account', 400);
    }

    if (idempotencyKey) {
        const existing = await Transaction.findOne({ idempotencyKey, userId }).session(session);
        if (existing) return existing;
    }

    // Step 1: Validate both accounts exist
    const [fromAccount, toAccount] = await Promise.all([
        Account.findOne({ _id: fromAccountId, userId }).session(session),
        Account.findOne({ _id: toAccountId, userId }).session(session),
    ]);

    if (!fromAccount) throw new AppError('Source account not found', 404);
    if (!toAccount) throw new AppError('Destination account not found', 404);
    if (fromAccount.isDeleted || toAccount.isDeleted) throw new AppError('Cannot create transaction in a deleted account', 400);

    // Step 2: Try to deduct from source
    let deductQuery;
    if (fromAccount.type === 'CREDIT_CARD') {
        deductQuery = {
            _id: fromAccount._id,
            $expr: {
                $lte: [
                    { $add: [{ $abs: '$balance' }, amount] },
                    '$creditLimit'
                ]
            }
        };
    } else {
        deductQuery = {
            _id: fromAccount._id,
            balance: { $gte: amount }
        };
    }

    const deductedAccount = await Account.findOneAndUpdate(
        deductQuery,
        { $inc: { balance: -amount } },
        { new: true, session }
    );

    if (!deductedAccount) {
        throw new AppError('Transfer declined: Insufficient funds or credit limit exceeded in source account', 400);
    }

    // Step 3: Try to credit destination
    const creditedAccount = await Account.findOneAndUpdate(
        { _id: toAccount._id },
        { $inc: { balance: amount } },
        { new: true, session }
    );

    if (!creditedAccount) {
        if (!session) {
            // Best effort retry loop if not in a transaction
            let retries = 3;
            let success = false;
            while (retries > 0 && !success) {
                const retryCredit = await Account.findOneAndUpdate(
                    { _id: toAccount._id },
                    { $inc: { balance: amount } }
                );
                if (retryCredit) success = true;
                retries--;
            }
            if (!success) {
                console.error(`[FATAL] Money stuck! Deducted ${amount} from ${fromAccountId} but failed to credit ${toAccountId}. Needs manual reconciliation.`);
            }
        } else {
            throw new AppError('Transfer declined: Destination account update failed', 500);
        }
    }

    const transaction = await Transaction.create([{
        userId,
        idempotencyKey,
        type: 'TRANSFER',
        amount,
        fromAccountId,
        toAccountId,
        category: 'Transfer',
        note,
        date: date || new Date(),
    }], { session }).then(res => res[0]);

    return transaction;
}

/**
 * Deletes a transaction and rolls back the account balances.
 * Performs a soft delete by marking isDeleted: true.
 */
export async function deleteTransaction(transactionId, userId, session = null) {
    const transaction = await Transaction.findOne({ _id: transactionId, userId, isDeleted: false }).session(session);
    if (!transaction) throw new AppError('Transaction not found or already deleted', 404);

    if (transaction.type === 'EXPENSE') {
        // Roll back expense: Add money back to fromAccount
        await Account.findOneAndUpdate(
            { _id: transaction.fromAccountId, userId },
            { $inc: { balance: transaction.amount } },
            { session }
        );
    } else if (transaction.type === 'INCOME') {
        // Roll back income: Deduct money from toAccount
        await Account.findOneAndUpdate(
            { _id: transaction.toAccountId, userId },
            { $inc: { balance: -transaction.amount } },
            { session }
        );
    } else if (transaction.type === 'TRANSFER') {
        // Roll back transfer: Return money from destination to source
        await Promise.all([
            Account.findOneAndUpdate(
                { _id: transaction.fromAccountId, userId },
                { $inc: { balance: transaction.amount } },
                { session }
            ),
            Account.findOneAndUpdate(
                { _id: transaction.toAccountId, userId },
                { $inc: { balance: -transaction.amount } },
                { session }
            )
        ]);
    }

    // Soft Delete
    transaction.isDeleted = true;
    transaction.deletedAt = new Date();
    await transaction.save({ session });
    return true;
}
