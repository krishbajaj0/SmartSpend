import mongoose from 'mongoose';

const accountSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        index: true,
    },
    name: {
        type: String,
        required: [true, 'Account name is required'],
        trim: true,
        maxlength: 50,
    },
    type: {
        type: String,
        required: [true, 'Account type is required'],
        enum: ['WALLET', 'BANK', 'CREDIT_CARD'],
    },
    currency: {
        type: String,
        default: 'INR',
    },
    balance: {
        type: Number,
        default: 0,
        // Represents derived/cached sum of ledger. 
        // Wallet/Bank: >= 0. Credit Card: <= 0 (debt).
    },
    // Credit Card Specific
    creditLimit: {
        type: Number,
        default: null,
        min: 0,
    },
    // Bank Specific
    accountNumber: {
        type: String,
        trim: true,
        default: '',
    },
    bankName: {
        type: String,
        trim: true,
        default: '',
    },
    isDeleted: {
        type: Boolean,
        default: false,
    },
}, {
    timestamps: true,
});

accountSchema.index({ userId: 1, isDeleted: 1 });

const Account = mongoose.model('Account', accountSchema);
export default Account;
