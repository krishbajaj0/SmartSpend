import mongoose from 'mongoose';

const chatMessageSchema = new mongoose.Schema({
    sessionId: {
        type: String,
        required: true,
        index: true,
    },
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        index: true,
    },

    role: {
        type: String,
        required: true,
        enum: ['user', 'assistant'],
    },

    message: {
        type: String,
        required: true,
        maxlength: 500,
    },

    // ── Assistant-only fields ──
    structuredResponse: {
        type: mongoose.Schema.Types.Mixed,
        default: null,
    },
    intent: {
        type: String,
        default: null,
    },
    intentVersion: {
        type: String,
        default: null,
    },
    intentConfidence: {
        type: Number,
        default: null,
        min: 0,
        max: 1,
    },
    conversationState: {
        type: mongoose.Schema.Types.Mixed,
        default: null,
    },
    responseTimeMs: {
        type: Number,
        default: null,
    },
    aiSource: {
        type: String,
        default: null,
    },
    errorCode: {
        type: String,
        default: null,
    },

    // ── TTL ──
    expiresAt: {
        type: Date,
        default: () => new Date(Date.now() + 90 * 24 * 60 * 60 * 1000), // 90 days
    },
}, {
    timestamps: true,
});

// TTL index — MongoDB auto-deletes documents after expiresAt
chatMessageSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

// Session lookup (user's recent sessions)
chatMessageSchema.index({ userId: 1, createdAt: -1 });

// Session messages in order
chatMessageSchema.index({ sessionId: 1, createdAt: 1 });

const ChatMessage = mongoose.model('ChatMessage', chatMessageSchema);
export default ChatMessage;
