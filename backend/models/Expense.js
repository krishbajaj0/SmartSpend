import mongoose from 'mongoose';

const expenseSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        index: true,
    },
    amount: { type: Number, required: [true, 'Amount is required'], min: 0 },
    currency: { type: String, default: 'INR' },
    category: {
        type: String,
        required: [true, 'Category is required'],
        enum: ['food', 'transport', 'shopping', 'bills', 'entertainment', 'health', 'education', 'travel', 'groceries', 'subscriptions', 'other'],
    },
    subCategory: { type: String, default: '' },
    merchant: { type: String, required: [true, 'Merchant is required'], trim: true },
    merchantNormalized: { type: String, trim: true, lowercase: true },
    date: { type: Date, required: [true, 'Date is required'], index: true },
    notes: { type: String, default: '', maxlength: 500 },
    tags: [{ type: String, trim: true }],
    receiptUrl: { type: String, default: '' },
    receiptOcrData: { type: String, default: '' },
    isRecurring: { type: Boolean, default: false },
    recurringInterval: {
        type: String,
        enum: ['daily', 'weekly', 'monthly', 'yearly', ''],
        default: '',
    },
    nextRecurrenceDate: Date,
    aiCategorized: { type: Boolean, default: false },
    aiConfidence: { type: Number, default: 0, min: 0, max: 1 },
    location: {
        lat: Number,
        lng: Number,
        address: String,
    },
    isDeleted: { type: Boolean, default: false },
    deletedAt: Date,
}, {
    timestamps: true,
});

// Auto-set merchantNormalized
expenseSchema.pre('save', function (next) {
    if (this.isModified('merchant')) {
        this.merchantNormalized = this.merchant.toLowerCase().trim();
    }
    next();
});

// Indexes for performance
expenseSchema.index({ userId: 1, date: -1 });
expenseSchema.index({ userId: 1, category: 1 });
expenseSchema.index({ userId: 1, merchantNormalized: 1 });
expenseSchema.index({ userId: 1, isDeleted: 1, date: -1 });

// Text index for search
expenseSchema.index({ merchant: 'text', notes: 'text' });

const Expense = mongoose.model('Expense', expenseSchema);
export default Expense;
