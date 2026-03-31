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
        min: 0,
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

budgetSchema.index({ userId: 1, category: 1 }, { unique: true });

const Budget = mongoose.model('Budget', budgetSchema);
export default Budget;
