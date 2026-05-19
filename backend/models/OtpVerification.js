import mongoose from 'mongoose';

const otpVerificationSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },
    email: { 
        type: String, 
        required: true, 
        lowercase: true, 
        trim: true 
    },
    purpose: { 
        type: String, 
        required: true, 
        enum: ['register', 'login', 'forgot_password'] 
    },
    otpHash: { 
        type: String, 
        required: true 
    },
    attempts: { 
        type: Number, 
        default: 0, 
        min: 0 
    },
    maxAttempts: {
        type: Number,
        default: 5
    },
    lastSentAt: { 
        type: Date, 
        required: true 
    },
    lockUntil: { 
        type: Date 
    },
    expiresAt: { 
        type: Date, 
        required: true 
    },
    verified: {
        type: Boolean,
        default: false
    },
    ip: {
        type: String
    },
    userAgent: {
        type: String
    }
}, { 
    timestamps: true 
});

// Compound unique index ensuring only one active verification flow per email + purpose
otpVerificationSchema.index({ email: 1, purpose: 1 }, { unique: true });

// TTL Index for automatic collection cleanup by MongoDB background thread
otpVerificationSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export default mongoose.model('OtpVerification', otpVerificationSchema);
