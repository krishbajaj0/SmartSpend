import mongoose from 'mongoose';

const idempotencyKeySchema = new mongoose.Schema({
    key: { type: String, required: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    route: { type: String, required: true },
    method: { type: String, required: true },
    requestHash: { type: String, required: true },
    responseHash: String,
    statusCode: Number,
    responseBody: mongoose.Schema.Types.Mixed,
    completed: { type: Boolean, default: false },
    expiresAt: { type: Date, required: true },
}, { timestamps: true });

idempotencyKeySchema.index({ userId: 1, route: 1, method: 1, key: 1 }, { unique: true });
idempotencyKeySchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

const IdempotencyKey = mongoose.model('IdempotencyKey', idempotencyKeySchema);
export default IdempotencyKey;
