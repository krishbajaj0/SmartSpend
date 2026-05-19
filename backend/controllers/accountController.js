import Account from '../models/Account.js';
import Transaction from '../models/Transaction.js';
import { AppError } from '../middleware/errorHandler.js';
import { invalidateUserDerivedCache } from '../utils/cache.js';

export async function getAccounts(req, res, next) {
    try {
        const accounts = await Account.find({ userId: req.user._id, isDeleted: false }).lean();

        let netWorth = 0;
        const enrichedAccounts = accounts.map(acc => {
            let utilization = 0;
            if (acc.type === 'CREDIT_CARD' && acc.creditLimit > 0) {
                // balance is negative for debt. utilization = abs(balance) / limit
                utilization = Math.min(100, Math.round((Math.abs(acc.balance) / acc.creditLimit) * 100));
            }
            
            // balance is already negative for debt, so simply summing calculates net worth correctly
            netWorth += acc.balance;

            return {
                ...acc,
                utilization
            };
        });

        res.json({ success: true, accounts: enrichedAccounts, netWorth });
    } catch (err) { next(err); }
}

export async function createAccount(req, res, next) {
    try {
        const { name, type, currency, balance, creditLimit, accountNumber, bankName, billingCycleDate, dueDate } = req.body;

        let initialBalance = Number(balance) || 0;
        if (type === 'CREDIT_CARD' && initialBalance > 0) {
            initialBalance = -initialBalance; // Debt is negative
        }

        const data = {
            userId: req.user._id,
            name,
            type,
            currency: currency || 'INR',
            balance: initialBalance
        };

        if (type === 'CREDIT_CARD') {
            data.creditLimit = creditLimit || 0;
            data.billingCycleDate = billingCycleDate;
            data.dueDate = dueDate;
        } else if (type === 'BANK') {
            data.accountNumber = accountNumber;
            data.bankName = bankName;
        }

        const account = await Account.create(data);

        // If there's an initial balance, record it in the ledger as an 'Income' (Opening Balance)
        // or a negative starting point.
        if (initialBalance !== 0) {
            await Transaction.create({
                userId: req.user._id,
                type: initialBalance > 0 ? 'INCOME' : 'EXPENSE',
                amount: Math.abs(initialBalance),
                [initialBalance > 0 ? 'toAccountId' : 'fromAccountId']: account._id,
                category: 'Adjustment',
                note: 'Opening Balance',
                date: new Date()
            });
        }

        invalidateUserDerivedCache(req.user._id);

        res.status(201).json({ success: true, account });
    } catch (err) { next(err); }
}

export async function updateAccount(req, res, next) {
    try {
        const { name, balance, creditLimit, accountNumber, bankName, billingCycleDate, dueDate } = req.body;
        const account = await Account.findOne({ _id: req.params.id, userId: req.user._id, isDeleted: false });

        if (!account) throw new AppError('Account not found', 404);

        // Handle balance adjustment
        if (balance !== undefined) {
            let newBalance = Number(balance);
            if (account.type === 'CREDIT_CARD' && newBalance > 0) {
                newBalance = -newBalance;
            }

            const diff = newBalance - account.balance;
            if (diff !== 0) {
                await Transaction.create({
                    userId: req.user._id,
                    type: diff > 0 ? 'INCOME' : 'EXPENSE',
                    amount: Math.abs(diff),
                    [diff > 0 ? 'toAccountId' : 'fromAccountId']: account._id,
                    category: 'Adjustment',
                    note: 'Manual Balance Adjustment',
                    date: new Date()
                });
                account.balance = newBalance;
            }
        }

        if (name) account.name = name;
        if (account.type === 'CREDIT_CARD') {
            if (creditLimit !== undefined) account.creditLimit = creditLimit;
            if (billingCycleDate) account.billingCycleDate = billingCycleDate;
            if (dueDate) account.dueDate = dueDate;
        } else if (account.type === 'BANK') {
            if (accountNumber) account.accountNumber = accountNumber;
            if (bankName) account.bankName = bankName;
        }

        await account.save();
        invalidateUserDerivedCache(req.user._id);

        res.json({ success: true, account });
    } catch (err) { next(err); }
}

export async function deleteAccount(req, res, next) {
    try {
        const account = await Account.findOne({ _id: req.params.id, userId: req.user._id, isDeleted: false });
        if (!account) throw new AppError('Account not found', 404);

        // Check if transactions exist
        const txCount = await Transaction.countDocuments({
            $or: [{ fromAccountId: account._id }, { toAccountId: account._id }]
        });

        if (txCount > 0) {
            throw new AppError(`Cannot delete account: ${txCount} transactions are linked. Please reassign them first.`, 400);
        }

        account.isDeleted = true;
        await account.save();
        invalidateUserDerivedCache(req.user._id);

        res.json({ success: true, message: 'Account deleted' });
    } catch (err) { next(err); }
}

export async function getAccountTransactions(req, res, next) {
    try {
        const { page = 1, limit = 20 } = req.query;
        const skip = (Math.max(1, parseInt(page)) - 1) * Math.min(50, Math.max(1, parseInt(limit)));

        const filter = {
            userId: req.user._id,
            $or: [{ fromAccountId: req.params.id }, { toAccountId: req.params.id }]
        };

        const transactions = await Transaction.find(filter)
            .sort({ date: -1 })
            .skip(skip)
            .limit(parseInt(limit))
            .lean();

        const total = await Transaction.countDocuments(filter);

        res.json({
            success: true,
            transactions,
            pagination: { page: parseInt(page), limit: parseInt(limit), total }
        });
    } catch (err) { next(err); }
}
