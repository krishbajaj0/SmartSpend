import mongoose from 'mongoose';

const receiptSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        index: true,
    },
    fileName: { type: String, required: true },
    fileUrl: { type: String, required: true },
    fileSize: { type: Number },
    ocrData: {
        amount: { value: Number, confidence: Number },
        date: { value: String, confidence: Number },
        merchant: { value: String, confidence: Number },
        suggestedCategory: String,
        lineItems: [{
            name: String,
            amount: Number,
        }],
        rawText: String,
    },
    linkedTransactionId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Transaction',
    },
}, {
    timestamps: true,
});

const Receipt = mongoose.model('Receipt', receiptSchema);
export default Receipt;
