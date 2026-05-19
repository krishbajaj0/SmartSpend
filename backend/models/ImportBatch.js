import mongoose from 'mongoose';

const importBatchSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    status: {
        type: String,
        enum: ['previewed', 'committed', 'blocked', 'rolled_back', 'failed'],
        default: 'previewed',
        index: true,
    },
    fileName: String,
    fileHash: { type: String, required: true },
    totalRows: { type: Number, default: 0 },
    importedRows: { type: Number, default: 0 },
    skippedRows: { type: Number, default: 0 },
    errorRows: { type: Number, default: 0 },
    duplicateRows: { type: Number, default: 0 },
    ambiguousRows: { type: Number, default: 0 },
    committedAt: Date,
    rolledBackAt: Date,
    requestId: String,
}, { timestamps: true });

importBatchSchema.index({ userId: 1, fileHash: 1, createdAt: -1 });

const ImportBatch = mongoose.model('ImportBatch', importBatchSchema);
export default ImportBatch;
