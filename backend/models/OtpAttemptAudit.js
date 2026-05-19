import mongoose from 'mongoose';

const otpAttemptAuditSchema = new mongoose.Schema({
    email: { 
        type: String, 
        required: true, 
        lowercase: true, 
        trim: true 
    },
    action: { 
        type: String, 
        required: true
    },
    success: { 
        type: Boolean, 
        required: true 
    },
    reason: { 
        type: String 
    },
    ip: { 
        type: String, 
        required: true 
    },
    userAgent: { 
        type: String 
    },
    device: { 
        type: String 
    },
    country: {
        type: String,
        default: 'unknown'
    },
    timestamp: { 
        type: Date, 
        default: Date.now,
        required: true 
    }
}, { 
    timestamps: true 
});

// Optimization index for quick security lookup on IP or email activity
otpAttemptAuditSchema.index({ email: 1 });
otpAttemptAuditSchema.index({ timestamp: -1 });

export default mongoose.model('OtpAttemptAudit', otpAttemptAuditSchema);
