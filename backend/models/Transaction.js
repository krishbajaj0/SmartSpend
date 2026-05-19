import mongoose from 'mongoose';
import sanitizeHtml from 'sanitize-html';

const transactionSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        index: true,
    },
    idempotencyKey: {
        type: String,
        unique: true,
        sparse: true,
    },
    
    // ── Ledger Core ──
    type: {
        type: String,
        required: [true, 'Transaction type is required'],
        enum: ['EXPENSE', 'INCOME', 'TRANSFER', 'REFUND'],
    },
    amount: {
        type: Number,
        required: [true, 'Amount is required'],
        min: 0,
        max: 1e15,
    },
    currency: { type: String, default: 'INR' },
    baseAmount: { type: Number, max: 1e15 },
    exchangeRate: { type: Number, default: 1 },
    fromAccountId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Account',
        default: null,
    },
    toAccountId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Account',
        default: null,
    },
    
    // ── Metadata ──
    category: {
        type: String,
        default: 'other',
    },
    subCategory: { type: String, default: '' },
    merchant: {
        type: String,
        default: '',
        trim: true,
    },
    merchantNormalized: { type: String, trim: true, lowercase: true },
    note: {
        type: String,
        default: '',
        maxlength: 500,
    },
    date: {
        type: Date,
        required: true,
        default: Date.now,
    },
    tags: [{ type: String, trim: true }],
    
    // ── Attachments & Imports ──
    receiptUrl: { type: String, default: '' },
    receiptOcrData: { type: String, default: '' },
    importBatchId: { type: mongoose.Schema.Types.ObjectId, ref: 'ImportBatch', index: true },
    sourceHash: { type: String },
    sourceRow: mongoose.Schema.Types.Mixed,
    
    // ── Automation & AI ──
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
    
    // ── Soft Delete ──
    isDeleted: { type: Boolean, default: false },
    deletedAt: Date,
}, {
    timestamps: true,
    optimisticConcurrency: true,
});

// Auto-set merchantNormalized
transactionSchema.pre('save', function (next) {
    if (this.isModified('merchant')) {
        this.merchantNormalized = this.merchant.toLowerCase().trim();
    }
    next();
});

// XSS Sanitization for text fields
function sanitizeFields(doc) {
    if (doc.note) doc.note = sanitizeHtml(doc.note, { allowedTags: [], allowedAttributes: {} });
    if (doc.merchant) doc.merchant = sanitizeHtml(doc.merchant, { allowedTags: [], allowedAttributes: {} });
    if (doc.subCategory) doc.subCategory = sanitizeHtml(doc.subCategory, { allowedTags: [], allowedAttributes: {} });
}

transactionSchema.pre('save', function (next) {
    sanitizeFields(this);
    next();
});

transactionSchema.pre('findOneAndUpdate', function (next) {
    const update = this.getUpdate();
    if (update.$set) {
        if (update.$set.note) update.$set.note = sanitizeHtml(update.$set.note, { allowedTags: [], allowedAttributes: {} });
        if (update.$set.merchant) update.$set.merchant = sanitizeHtml(update.$set.merchant, { allowedTags: [], allowedAttributes: {} });
        if (update.$set.subCategory) update.$set.subCategory = sanitizeHtml(update.$set.subCategory, { allowedTags: [], allowedAttributes: {} });
    } else if (update.note || update.merchant || update.subCategory) {
        sanitizeFields(update);
    }
    next();
});

// ── Indexes (ESR Optimized) ──

// Primary dashboard/list query (specific type)
transactionSchema.index({ userId: 1, type: 1, isDeleted: 1, date: -1 });

// Global dashboard list query (all types)
transactionSchema.index({ userId: 1, isDeleted: 1, date: -1 });

// Category breakdowns (Analytics / Budgets)
transactionSchema.index({ userId: 1, type: 1, isDeleted: 1, category: 1, date: -1 });

// Autosuggest / Search
transactionSchema.index({ userId: 1, type: 1, merchantNormalized: 1 });

// Cron scheduler
transactionSchema.index({ isRecurring: 1, isDeleted: 1, type: 1, nextRecurrenceDate: 1 });

// Account ledgers
transactionSchema.index({ fromAccountId: 1, date: -1 });
transactionSchema.index({ toAccountId: 1, date: -1 });

// Full-text search
transactionSchema.index({ merchant: 'text', note: 'text' });

// Unique import hash
transactionSchema.index(
    { userId: 1, importBatchId: 1, sourceHash: 1 },
    { unique: true, partialFilterExpression: { sourceHash: { $type: 'string' } } }
);

const Transaction = mongoose.model('Transaction', transactionSchema);
export default Transaction;
