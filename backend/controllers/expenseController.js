import Expense from '../models/Expense.js';
import { AppError } from '../middleware/errorHandler.js';
import { categorizeExpense } from '../services/ai/categorizer.js';
import { checkBudgetAlerts } from '../services/notifications/budgetAlerts.js';

// POST /api/expenses
export async function createExpense(req, res, next) {
    try {
        const data = { ...req.body, userId: req.user._id };

        // AI auto-categorization if no category
        if (!data.category) {
            const suggestion = await categorizeExpense(req.user._id, data.merchant, data.notes, data.amount);
            data.category = suggestion.category;
            data.aiCategorized = true;
            data.aiConfidence = suggestion.confidence;
        } else if (data.aiCategorized === undefined) {
            data.aiCategorized = false;
        }

        const expense = await Expense.create(data);

        // Trigger budget check
        checkBudgetAlerts(req.user._id, expense.category).catch((err) => {
            console.error(`[Budget Alert Error]: ${err.message}`);
        });

        res.status(201).json({ success: true, expense });
    } catch (err) { next(err); }
}

// GET /api/expenses
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

        const filter = { userId: req.user._id, isDeleted: false };

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

        const sort = {};
        sort[sortBy] = sortOrder === 'asc' ? 1 : -1;

        const skip = (Number(page) - 1) * Number(limit);
        const [expenses, total] = await Promise.all([
            Expense.find(filter).sort(sort).skip(skip).limit(Number(limit)),
            Expense.countDocuments(filter),
        ]);

        res.json({
            success: true,
            expenses,
            pagination: {
                page: Number(page),
                limit: Number(limit),
                total,
                pages: Math.ceil(total / Number(limit)),
            },
        });
    } catch (err) { next(err); }
}

// GET /api/expenses/:id
export async function getExpense(req, res, next) {
    try {
        const expense = await Expense.findOne({ _id: req.params.id, userId: req.user._id, isDeleted: false });
        if (!expense) throw new AppError('Expense not found', 404);
        res.json({ success: true, expense });
    } catch (err) { next(err); }
}

// PUT /api/expenses/:id
export async function updateExpense(req, res, next) {
    try {
        const expense = await Expense.findOne({ _id: req.params.id, userId: req.user._id, isDeleted: false });
        if (!expense) throw new AppError('Expense not found', 404);

        // If user corrects category, mark as not AI-categorized (feedback loop)
        if (req.body.category && req.body.category !== expense.category) {
            req.body.aiCategorized = false;
            // Store user correction for AI learning (handled by categorizer service)
        }

        Object.assign(expense, req.body);
        await expense.save();

        res.json({ success: true, expense });
    } catch (err) { next(err); }
}

// DELETE /api/expenses/:id (soft delete)
export async function deleteExpense(req, res, next) {
    try {
        const expense = await Expense.findOne({ _id: req.params.id, userId: req.user._id, isDeleted: false });
        if (!expense) throw new AppError('Expense not found', 404);

        expense.isDeleted = true;
        expense.deletedAt = new Date();
        await expense.save();

        res.json({ success: true, message: 'Expense deleted' });
    } catch (err) { next(err); }
}

// POST /api/expenses/bulk-delete
export async function bulkDelete(req, res, next) {
    try {
        const { ids } = req.body;
        if (!ids || !Array.isArray(ids) || ids.length === 0) throw new AppError('No IDs provided', 400);
        if (ids.length > 500) throw new AppError('Cannot delete more than 500 items at once to prevent overload', 400);

        await Expense.updateMany(
            { _id: { $in: ids }, userId: req.user._id },
            { isDeleted: true, deletedAt: new Date() }
        );

        res.json({ success: true, message: `${ids.length} expenses deleted` });
    } catch (err) { next(err); }
}

// GET /api/expenses/recurring
export async function getRecurringExpenses(req, res, next) {
    try {
        const expenses = await Expense.find({
            userId: req.user._id, isDeleted: false, isRecurring: true,
        }).sort({ date: -1 });
        res.json({ success: true, expenses });
    } catch (err) { next(err); }
}

// POST /api/expenses/duplicate/:id
export async function duplicateExpense(req, res, next) {
    try {
        const original = await Expense.findOne({ _id: req.params.id, userId: req.user._id });
        if (!original) throw new AppError('Expense not found', 404);

        const dup = original.toObject();
        delete dup._id;
        delete dup.createdAt;
        delete dup.updatedAt;
        dup.date = new Date();
        dup.isDeleted = false;

        const expense = await Expense.create(dup);
        res.status(201).json({ success: true, expense });
    } catch (err) { next(err); }
}
