import { startTransactionIfSupported, commitTransactionIfSupported, abortTransactionIfSupported } from '../utils/session.js';
import Transaction from '../models/Transaction.js';
import Account from '../models/Account.js';
import { createExpenseTransaction, deleteTransaction } from '../services/transactionService.js';
import { AppError } from '../middleware/errorHandler.js';
import { categorizeExpense } from '../services/ai/categorizer.js';
import { checkBudgetAlerts } from '../services/notifications/budgetAlerts.js';
import { convertToBaseCurrency } from '../services/currencyService.js';
import { invalidateUserDerivedCache } from '../utils/cache.js';
import { writeAuditLog } from '../utils/audit.js';
import logger from '../config/logger.js';
import { ACTIVE_TRANSACTION_FILTER } from '../config/constants.js';

const QUERY_TIMEOUT = 5_000;

// POST /api/expenses
export async function createExpense(req, res, next) {
    try {
        const allowedFields = [
            'amount', 'currency', 'merchant', 'category',
            'date', 'notes', 'tags', 'isRecurring'
        ];

        // Reject unknown fields
        const invalidFields = Object.keys(req.body).filter(k => !allowedFields.includes(k));
        if (invalidFields.length) {
            throw new AppError(`Invalid fields: ${invalidFields.join(', ')}`, 400);
        }

        // Safe parsing
        const amount = Number(req.body.amount);
        if (!Number.isFinite(amount) || amount <= 0) {
            throw new AppError('Valid amount is required', 400);
        }

        const data = {
            amount,
            currency: req.body.currency,
            merchant: String(req.body.merchant || '').trim(),
            category: req.body.category,
            date: req.body.date ? new Date(req.body.date) : new Date(),
            notes: req.body.notes,
            tags: Array.isArray(req.body.tags) ? req.body.tags : [],
            isRecurring: Boolean(req.body.isRecurring),
            userId: req.user._id
        };

        // Calculate base amount
        const expenseCurrency = data.currency || 'INR';
        const baseCurrency = req.user.currency || 'INR';
        const conversion = await convertToBaseCurrency(data.amount, expenseCurrency, baseCurrency);
        data.baseAmount = conversion.baseAmount;
        data.exchangeRate = conversion.exchangeRate;

        // AI auto-categorization if no category
        if (!data.category) {
            const suggestion = await categorizeExpense(req.user._id, data.merchant, data.notes, data.amount);
            data.category = suggestion.category;
            data.aiCategorized = true;
            data.aiConfidence = suggestion.confidence;
        } else if (data.aiCategorized === undefined) {
            data.aiCategorized = false;
        }

        // DUAL WRITE STRATEGY

        // Get default account for ledger if no specific account provided
        let fromAccountId = req.body.fromAccountId;
        if (!fromAccountId) {
            let sysAccount = await Account.findOne({ userId: req.user._id, name: 'Migrated Balance' });
            if (!sysAccount) {
                sysAccount = await Account.create({
                    userId: req.user._id,
                    name: 'Migrated Balance',
                    type: 'WALLET',
                    balance: 0,
                    currency: 'INR',
                });
            }
            fromAccountId = sysAccount._id;
        }

        const idempotencyKey = `dw_expense_${Date.now()}_${Math.random().toString(36).substring(7)}`;

        const transaction = await createExpenseTransaction({
            userId: req.user._id,
            amount: data.amount,
            fromAccountId,
            merchant: data.merchant,
            category: data.category,
            note: data.notes,
            date: data.date,
            idempotencyKey
        });

        // Add the extra fields to transaction manually since createExpenseTransaction doesn't take all metadata yet
        Object.assign(transaction, {
            currency: data.currency || 'INR',
            baseAmount: data.baseAmount,
            exchangeRate: data.exchangeRate,
            tags: data.tags,
            isRecurring: data.isRecurring,
            aiCategorized: data.aiCategorized || false,
            aiConfidence: data.aiConfidence || 0,
        });
        await transaction.save();


        await writeAuditLog(req, {
            entityType: 'expense',
            entityId: transaction._id,
            action: 'create',
            after: transaction.toObject(),
        });

        // Trigger budget check
        checkBudgetAlerts(req.user._id, transaction.category).catch((err) => {
            logger.warn({ err }, '[Budget Alert] background check failed');
        });

        invalidateUserDerivedCache(req.user._id);

        res.status(201).json({ success: true, expense: transaction });
    } catch (err) { next(err); }
}

// GET /api/expenses (Reads from Transaction)
export async function getExpenses(req, res, next) {
    try {
        const {
            page = 1, limit = 20,
            category, merchant, search,
            dateFrom, dateTo,
            amountMin, amountMax,
            tags, isRecurring,
            sortBy = 'date', sortOrder = 'desc',
        } = req.query;

        const filter = { userId: req.user._id, ...ACTIVE_TRANSACTION_FILTER, type: 'EXPENSE' };

        if (category) filter.category = category;
        if (isRecurring !== undefined) filter.isRecurring = isRecurring === 'true';
        if (merchant) filter.merchantNormalized = { $regex: merchant.toLowerCase(), $options: 'i' };
        if (tags) filter.tags = { $in: tags.split(',').map(t => t.trim()) };

        if (dateFrom || dateTo) {
            filter.date = {};
            if (dateFrom) filter.date.$gte = new Date(dateFrom);
            if (dateTo) filter.date.$lte = new Date(dateTo);
        }
        if (amountMin || amountMax) {
            filter.amount = {};
            if (amountMin) filter.amount.$gte = Number(amountMin);
            if (amountMax) filter.amount.$lte = Number(amountMax);
        }
        if (search) {
            filter.$text = { $search: search };
        }

        const parsedLimit = Math.min(Math.max(parseInt(limit, 10) || 20, 1), 50);
        const parsedPage = Math.max(parseInt(page, 10) || 1, 1);
        const sort = {};
        sort[sortBy] = sortOrder === 'asc' ? 1 : -1;

        const skip = (parsedPage - 1) * parsedLimit;

        const skipCount = req.query.skipCount === 'true';

        const [expenses, total] = await Promise.all([
            Transaction
                .find(filter)
                .sort(sort)
                .skip(skip)
                .limit(parsedLimit)
                .lean()
                .maxTimeMS(QUERY_TIMEOUT),
            skipCount
                ? Promise.resolve(null)
                : Transaction.countDocuments(filter).maxTimeMS(QUERY_TIMEOUT),
        ]);

        res.json({
            success: true,
            expenses,
            pagination: {
                page: parsedPage,
                limit: parsedLimit,
                total,
                pages: total !== null ? Math.ceil(total / parsedLimit) : undefined,
            },
        });
    } catch (err) { next(err); }
}

// GET /api/expenses/:id
export async function getExpense(req, res, next) {
    try {
        const expense = await Transaction.findOne({ _id: req.params.id, userId: req.user._id, ...ACTIVE_TRANSACTION_FILTER, type: 'EXPENSE' }).maxTimeMS(QUERY_TIMEOUT);
        if (!expense) throw new AppError('Expense not found', 404);
        res.json({ success: true, expense });
    } catch (err) { next(err); }
}

// PUT /api/expenses/:id
export async function updateExpense(req, res, next) {
    try {
        const transaction = await Transaction.findOne({ _id: req.params.id, userId: req.user._id, ...ACTIVE_TRANSACTION_FILTER, type: 'EXPENSE' }).maxTimeMS(QUERY_TIMEOUT);
        if (!transaction) throw new AppError('Expense not found', 404);

        const before = transaction.toObject();

        const allowedFields = [
            'amount', 'merchant', 'category', 'currency', 'date',
            'notes', 'note', 'tags', 'isRecurring', 'recurringInterval',
            'subCategory', 'location', 'receiptUrl',
        ];
        const updates = {};
        for (const key of allowedFields) {
            if (req.body[key] !== undefined) updates[key === 'notes' ? 'note' : key] = req.body[key];
        }

        if (updates.category && updates.category !== transaction.category) {
            updates.aiCategorized = false;
        }

        if (updates.amount !== undefined || updates.currency !== undefined) {
            const amount = updates.amount !== undefined ? updates.amount : transaction.amount;
            const currency = updates.currency !== undefined ? updates.currency : transaction.currency;
            const baseCurrency = req.user.currency || 'INR';

            const conversion = await convertToBaseCurrency(amount, currency || 'INR', baseCurrency);
            transaction.baseAmount = conversion.baseAmount;
            transaction.exchangeRate = conversion.exchangeRate;
        }

        Object.assign(transaction, updates);

        try {
            await transaction.save();
            

            await writeAuditLog(req, {
                entityType: 'expense',
                entityId: transaction._id,
                action: 'update',
                before,
                after: transaction.toObject(),
            });
        } catch (err) {
            if (err.name === 'VersionError') {
                throw new AppError('Conflict: This expense was modified elsewhere. Please refresh.', 409);
            }
            throw err;
        }

        invalidateUserDerivedCache(req.user._id);
        res.json({ success: true, expense: transaction });
    } catch (err) { next(err); }
}

// DELETE /api/expenses/:id
export async function deleteExpense(req, res, next) {
    try {
        const transaction = await Transaction.findOne({ _id: req.params.id, userId: req.user._id, ...ACTIVE_TRANSACTION_FILTER, type: 'EXPENSE' });
        if (!transaction) throw new AppError('Expense not found', 404);
        const before = transaction.toObject();

        // 1. Roll back the ledger entry to fix account balance
        await deleteTransaction(transaction._id, req.user._id);


        await writeAuditLog(req, {
            entityType: 'expense',
            entityId: transaction._id,
            action: 'delete',
            before,
            after: { ...transaction.toObject(), isDeleted: true },
        });

        invalidateUserDerivedCache(req.user._id);
        res.json({ success: true, message: 'Expense deleted and balance rolled back' });
    } catch (err) { next(err); }
}

// POST /api/expenses/bulk-delete
export async function bulkDelete(req, res, next) {
    try {
        const { ids } = req.body;
        if (!ids || !Array.isArray(ids) || ids.length === 0) throw new AppError('No IDs provided', 400);
        if (ids.length > 500) throw new AppError('Cannot delete more than 500 items at once', 400);

        const transactions = await Transaction.find({ _id: { $in: ids }, userId: req.user._id, ...ACTIVE_TRANSACTION_FILTER, type: 'EXPENSE' });
        
        for (const exp of transactions) {
            await deleteTransaction(exp._id, req.user._id).catch(err => {
                logger.error({ err, expId: exp._id }, 'Failed to rollback transaction in bulk delete');
            });
        }


        invalidateUserDerivedCache(req.user._id);
        res.json({ success: true, message: `${transactions.length} expenses deleted` });
    } catch (err) { next(err); }
}

// GET /api/expenses/recurring
export async function getRecurringExpenses(req, res, next) {
    try {
        const expenses = await Transaction.find({
            userId: req.user._id, ...ACTIVE_TRANSACTION_FILTER, isRecurring: true, type: 'EXPENSE'
        }).sort({ date: -1 }).lean().maxTimeMS(QUERY_TIMEOUT);
        res.json({ success: true, expenses });
    } catch (err) { next(err); }
}

// POST /api/expenses/duplicate/:id
export async function duplicateExpense(req, res, next) {
    let session = null;
    try {
        const original = await Transaction.findOne({ _id: req.params.id, userId: req.user._id, type: 'EXPENSE' }).maxTimeMS(QUERY_TIMEOUT);
        if (!original) throw new AppError('Expense not found', 404);

        session = await startTransactionIfSupported();

        const idempotencyKey = `dup_expense_${Date.now()}_${Math.random().toString(36).substring(7)}`;
        
        let fromAccountId = original.fromAccountId;
        if (!fromAccountId) {
            const { getOrCreateMigratedBalanceAccount } = await import('../services/transactionService.js');
            fromAccountId = await getOrCreateMigratedBalanceAccount(req.user._id, session);
        }

        const transaction = await createExpenseTransaction({
            userId: req.user._id,
            amount: original.amount,
            fromAccountId,
            merchant: original.merchant,
            category: original.category,
            note: original.note || original.notes,
            date: new Date(),
            idempotencyKey
        }, session);

        // Add the extra fields to transaction manually
        Object.assign(transaction, {
            currency: original.currency || 'INR',
            tags: original.tags,
            isRecurring: original.isRecurring,
            aiCategorized: false,
            aiConfidence: 0,
        });

        const conversion = await convertToBaseCurrency(transaction.amount, transaction.currency || 'INR', req.user.currency || 'INR');
        transaction.baseAmount = conversion.baseAmount;
        transaction.exchangeRate = conversion.exchangeRate;

        await transaction.save({ session });

        await writeAuditLog(req, {
            entityType: 'expense',
            entityId: transaction._id,
            action: 'duplicate',
            after: transaction.toObject(),
        });

        await commitTransactionIfSupported(session);
        
        invalidateUserDerivedCache(req.user._id);

        res.status(201).json({ success: true, expense: transaction });
    } catch (err) { 
        if (session) {
            await abortTransactionIfSupported(session);
        }
        next(err); 
    }
}
