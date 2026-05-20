import mongoose from 'mongoose';

const loginActivityLogSchema = new mongoose.Schema(
    {
        userId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true,
            index: true,
        },
        email: {
            type: String,
            required: true,
        },
        ip: {
            type: String,
            required: true,
        },
        provider: {
            type: String,
            required: true,
        },
        userAgent: String,
        device: String,
        browser: String,
        os: String,
        timestamp: {
            type: Date,
            default: Date.now,
            expires: 90 * 24 * 60 * 60, // 90-day TTL auto-cleanup
        },
    },
    {
        timestamps: true,
    }
);

export default mongoose.model('LoginActivityLog', loginActivityLogSchema);
