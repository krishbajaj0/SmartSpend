import mongoose from 'mongoose';

const emailDeliveryMetricSchema = new mongoose.Schema({
    email: { 
        type: String, 
        required: true, 
        lowercase: true, 
        trim: true 
    },
    subject: { 
        type: String, 
        required: true 
    },
    success: { 
        type: Boolean, 
        required: true 
    },
    retryCount: { 
        type: Number, 
        default: 0 
    },
    provider: { 
        type: String, 
        required: true
    },
    latencyMs: { 
        type: Number, 
        required: true 
    },
    error: { 
        type: String 
    },
    timestamp: { 
        type: Date, 
        default: Date.now,
        required: true 
    }
}, { 
    timestamps: true 
});

// Optimization indexes
emailDeliveryMetricSchema.index({ provider: 1 });
emailDeliveryMetricSchema.index({ timestamp: -1 });
emailDeliveryMetricSchema.index({ success: 1 });

export default mongoose.model('EmailDeliveryMetric', emailDeliveryMetricSchema);
