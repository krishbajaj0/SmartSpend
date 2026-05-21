import {
    createExpenseTransaction,
    createIncomeTransaction,
    createTransferTransaction
} from '../services/transactionService.js';
import { invalidateUserDerivedCache } from '../utils/cache.js';
import Transaction from '../models/Transaction.js';
import { ACTIVE_TRANSACTION_FILTER } from '../config/constants.js';
import { startTransactionIfSupported, commitTransactionIfSupported, abortTransactionIfSupported } from '../utils/session.js';

export async function createExpense(req, res, next) {
    let session = null;
    try {
        const { amount, fromAccountId, category, note, date, idempotencyKey } = req.body;
        const merchant = req.body.merchant || (note ? note.split('-')[0].trim() : 'Unknown');

        session = await startTransactionIfSupported();

        // Create ledger entry in the Transaction collection (single source of truth)
        const transaction = await createExpenseTransaction({
            userId: req.user._id,
            amount: Number(amount),
            fromAccountId,
            merchant,
            category,
            note,
            date: date ? new Date(date) : new Date(),
            idempotencyKey
        }, session);

        await commitTransactionIfSupported(session);

        invalidateUserDerivedCache(req.user._id);

        // Return transaction as 'expense' for frontend compatibility
        res.status(201).json({ success: true, transaction, expense: transaction });
    } catch (err) { 
        if (session) {
            await abortTransactionIfSupported(session);
        }
        next(err); 
    }
}

export async function createIncome(req, res, next) {
    let session = null;
    try {
        const { amount, toAccountId, category, note, date, idempotencyKey } = req.body;

        session = await startTransactionIfSupported();

        const transaction = await createIncomeTransaction({
            userId: req.user._id,
            amount: Number(amount),
            toAccountId,
            category,
            note,
            date: date ? new Date(date) : new Date(),
            idempotencyKey
        }, session);

        await commitTransactionIfSupported(session);

        invalidateUserDerivedCache(req.user._id);

        res.status(201).json({ success: true, transaction });
    } catch (err) { 
        if (session) {
            await abortTransactionIfSupported(session);
        }
        next(err); 
    }
}

export async function createTransfer(req, res, next) {
    let session = null;
    try {
        const { amount, fromAccountId, toAccountId, note, date, idempotencyKey } = req.body;

        session = await startTransactionIfSupported();

        const transaction = await createTransferTransaction({
            userId: req.user._id,
            amount: Number(amount),
            fromAccountId,
            toAccountId,
            note,
            date: date ? new Date(date) : new Date(),
            idempotencyKey
        }, session);

        await commitTransactionIfSupported(session);

        invalidateUserDerivedCache(req.user._id);

        res.status(201).json({ success: true, transaction });
    } catch (err) { 
        if (session) {
            await abortTransactionIfSupported(session);
        }
        next(err); 
    }
}


export async function getTransactions(req, res, next) {
    try {
        const { page = 1, limit = 50, type, category } = req.query;
        const skip = (parseInt(page) - 1) * parseInt(limit);
        
        const filter = { userId: req.user._id, ...ACTIVE_TRANSACTION_FILTER };
        if (type) filter.type = type;
        if (category) filter.category = category;

        const [transactions, total] = await Promise.all([
            Transaction.find(filter)
                .sort({ date: -1 })
                .skip(skip)
                .limit(parseInt(limit))
                .lean(),
            Transaction.countDocuments(filter)
        ]);

        res.json({
            success: true,
            transactions,
            pagination: {
                total,
                page: parseInt(page),
                limit: parseInt(limit),
                pages: Math.ceil(total / parseInt(limit))
            }
        });
    } catch (err) { next(err); }
}
