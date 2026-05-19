import mongoose from 'mongoose';

const controlFlagSchema = new mongoose.Schema({
    key: { type: String, required: true },
    scopeType: { type: String, enum: ['global', 'feature', 'user'], default: 'global' },
    scopeId: { type: String, default: '*' },
    value: { type: mongoose.Schema.Types.Mixed, required: true },
    version: { type: Number, default: 1 },
    reason: String,
    expiresAt: Date,
    updatedBy: String,
}, { timestamps: true });

controlFlagSchema.index({ key: 1, scopeType: 1, scopeId: 1 }, { unique: true });
controlFlagSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0, sparse: true });

const ControlFlag = mongoose.model('ControlFlag', controlFlagSchema);
export default ControlFlag;
