import mongoose from 'mongoose';
import sanitizeHtml from 'sanitize-html';


const expenseSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        index: true,
    },
    transactionId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Transaction',
        index: true,
    },
    amount:      { type: Number, required: [true, 'Amount is required'], min: 0, max: 1e15 },
    currency:    { type: String, default: 'INR' },
    baseAmount:  { type: Number, max: 1e15 },
    exchangeRate:{ type: Number, default: 1 },
    category: {
        type: String,
        required: [true, 'Category is required'],
        enum: ['food', 'transport', 'shopping', 'bills', 'entertainment', 'health', 'education', 'travel', 'groceries', 'subscriptions', 'other'],
    },
    subCategory:        { type: String, default: '' },
    merchant:           { type: String, required: [true, 'Merchant is required'], trim: true },
    merchantNormalized: { type: String, trim: true, lowercase: true },
    date:               { type: Date, required: [true, 'Date is required'] },
    notes:              { type: String, default: '', maxlength: 500 },
    tags:               [{ type: String, trim: true }],
    receiptUrl:         { type: String, default: '' },
    receiptOcrData:     { type: String, default: '' },
    importBatchId:      { type: mongoose.Schema.Types.ObjectId, ref: 'ImportBatch', index: true },
    sourceHash:         { type: String },
    sourceRow:          mongoose.Schema.Types.Mixed,
    isRecurring:        { type: Boolean, default: false },
    recurringInterval: {
        type: String,
        enum: ['daily', 'weekly', 'monthly', 'yearly', ''],
        default: '',
    },
    nextRecurrenceDate: Date,
    aiCategorized:      { type: Boolean, default: false },
    aiConfidence:       { type: Number, default: 0, min: 0, max: 1 },
    location: {
        lat:     Number,
        lng:     Number,
        address: String,
    },
    isDeleted: { type: Boolean, default: false },
    deletedAt: Date,
}, {
    timestamps: true,
    optimisticConcurrency: true,
});

// Auto-set merchantNormalized
expenseSchema.pre('save', function (next) {
    if (this.isModified('merchant')) {
        this.merchantNormalized = this.merchant.toLowerCase().trim();
    }
    next();
});

// XSS Sanitization for text fields
function sanitizeFields(doc) {
    if (doc.notes) doc.notes = sanitizeHtml(doc.notes, { allowedTags: [], allowedAttributes: {} });
    if (doc.merchant) doc.merchant = sanitizeHtml(doc.merchant, { allowedTags: [], allowedAttributes: {} });
    if (doc.subCategory) doc.subCategory = sanitizeHtml(doc.subCategory, { allowedTags: [], allowedAttributes: {} });
}

expenseSchema.pre('save', function (next) {
    sanitizeFields(this);
    next();
});

expenseSchema.pre('findOneAndUpdate', function (next) {
    const update = this.getUpdate();
    if (update.$set) {
        if (update.$set.notes) update.$set.notes = sanitizeHtml(update.$set.notes, { allowedTags: [], allowedAttributes: {} });
        if (update.$set.merchant) update.$set.merchant = sanitizeHtml(update.$set.merchant, { allowedTags: [], allowedAttributes: {} });
        if (update.$set.subCategory) update.$set.subCategory = sanitizeHtml(update.$set.subCategory, { allowedTags: [], allowedAttributes: {} });
    } else if (update.notes || update.merchant || update.subCategory) {
        sanitizeFields(update);
    }
    next();
});


// ── Indexes ───────────────────────────────────────────────────────────────────
//
// INDEX DESIGN RATIONALE
// ──────────────────────
// Every analytics, dashboard, and list query filters on userId + isDeleted + date.
// The compound index order follows the ESR rule (Equality → Sort → Range):
//   userId  (equality — always present)
//   isDeleted (equality — always false in live queries)
//   date    (sort/range — used in $gte/$lte and sort({ date: -1 }))
//
// This single covering index satisfies:
//   - GET /api/expenses (list with date sort)
//   - GET /api/dashboard (30-day recent expenses)
//   - GET /api/analytics/* (monthly/yearly date-range aggregations)
//   - GET /api/analytics/export (full-range scan with sort)
//
// WHY isDeleted IS INCLUDED:
//   Without it, every query must filter isDeleted:false POST-index-scan, reading
//   ~all documents for the user. Including it means the index itself skips deleted docs.
//
expenseSchema.index({ userId: 1, isDeleted: 1, date: -1 });

//
// Category breakdown — used by analytics summary, dashboard budget cards, budget status.
// Query shape: { userId, isDeleted, date: { $gte } } + $group by category
// The category field enables index-only grouping (no document fetch for category value).
//
expenseSchema.index({ userId: 1, isDeleted: 1, category: 1, date: -1 });

//
// Merchant search — used by getExpenses (merchantNormalized regex filter).
// WHY merchantNormalized AND NOT merchant:
//   Case-insensitive regex on a normalised lowercase field with a prefix index
//   is far faster than a case-insensitive regex on the original mixed-case field.
//
expenseSchema.index({ userId: 1, merchantNormalized: 1 });

//
// Recurring expense cron job index.
// Query: { isRecurring: true, isDeleted: false, nextRecurrenceDate: { $lte: now } }
// This is a background job — not user-facing — but without an index it does
// a full collection scan every time the cron fires.
//
expenseSchema.index({ isRecurring: 1, isDeleted: 1, nextRecurrenceDate: 1 });

//
// Text index for full-text search (GET /api/expenses?search=...).
// merchant and notes are the two searched fields.
// MongoDB only allows one text index per collection.
//
expenseSchema.index({ merchant: 'text', notes: 'text' });
expenseSchema.index(
    { userId: 1, importBatchId: 1, sourceHash: 1 },
    { unique: true, partialFilterExpression: { sourceHash: { $type: 'string' } } }
);

const Expense = mongoose.model('Expense', expenseSchema);
export default Expense;
