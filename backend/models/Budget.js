import mongoose from 'mongoose';

const budgetSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        index: true,
    },
    category: {
        type: String,
        required: [true, 'Category is required'],
        enum: ['overall', 'food', 'transport', 'shopping', 'bills', 'entertainment', 'health', 'education', 'travel', 'groceries', 'subscriptions', 'other'],
    },
    limitAmount: {
        type: Number,
        required: [true, 'Budget limit is required'],
        min: [0.01, 'Budget limit must be greater than zero'],
    },
    warningThreshold: { type: Number, default: 75, min: 0, max: 100 },
    criticalThreshold: { type: Number, default: 90, min: 0, max: 100 },
    isActive: { type: Boolean, default: true },
    period: { type: String, default: 'monthly', enum: ['monthly', 'weekly'] },
    resetDay: { type: Number, default: 1 },
    history: [{
        month: Number,
        year: Number,
        totalSpent: Number,
        limitAmount: Number,
    }],
}, {
    timestamps: true,
});

budgetSchema.pre('validate', function (next) {
    if (this.warningThreshold >= this.criticalThreshold) {
        this.invalidate('warningThreshold', 'Warning threshold must be lower than critical threshold');
    }
    next();
});

// Unique constraint: one budget per user per category
budgetSchema.index({ userId: 1, category: 1 }, { unique: true });

// Active budget lookup — used on every dashboard and budget status request.
// Query: { userId, isActive: true }
// WHY: without this, every getBudgets / getBudgetStatus call does a collection
// scan over all budgets for the user (including soft-deleted / inactive ones).
budgetSchema.index({ userId: 1, isActive: 1 });

const Budget = mongoose.model('Budget', budgetSchema);
export default Budget;
