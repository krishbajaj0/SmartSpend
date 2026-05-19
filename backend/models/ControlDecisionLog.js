import mongoose from 'mongoose';

const controlDecisionLogSchema = new mongoose.Schema({
    requestId: { type: String, index: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true },
    key: { type: String, required: true, index: true },
    scopeType: String,
    scopeId: String,
    action: { type: String, required: true },
    path: String,
    method: String,
    ip: String,
    userAgent: String,
    flagVersion: Number,
    reason: String,
}, { timestamps: { createdAt: true, updatedAt: false } });

const ControlDecisionLog = mongoose.model('ControlDecisionLog', controlDecisionLogSchema);
export default ControlDecisionLog;
