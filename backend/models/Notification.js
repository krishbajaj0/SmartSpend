import mongoose from 'mongoose';

const notificationSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        index: true,
    },
    type: {
        type: String,
        required: true,
        enum: ['budget_warning', 'budget_critical', 'budget_exceeded', 'anomaly', 'milestone', 'insight', 'recurring', 'general'],
    },
    title: { type: String, required: true },
    message: { type: String, required: true },
    read: { type: Boolean, default: false },
    priority: { type: Number, default: 3, min: 1, max: 5 },
    metadata: { type: mongoose.Schema.Types.Mixed },
}, {
    timestamps: true,
});

notificationSchema.index({ userId: 1, read: 1, createdAt: -1 });
notificationSchema.index({ userId: 1, type: 1, 'metadata.dedupeKey': 1 }, { unique: true, sparse: true });

// TTL: auto-delete notifications older than 90 days
notificationSchema.index({ createdAt: 1 }, { expireAfterSeconds: 90 * 24 * 60 * 60 });

const Notification = mongoose.model('Notification', notificationSchema);
export default Notification;
