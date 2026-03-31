import mongoose from 'mongoose';
import bcrypt from 'bcrypt';
import constants from '../config/constants.js';

const userSchema = new mongoose.Schema({
    name: {
        type: String,
        required: [true, 'Name is required'],
        trim: true,
        maxlength: 100,
    },
    email: {
        type: String,
        required: [true, 'Email is required'],
        unique: true,
        lowercase: true,
        trim: true,
        match: [/^\S+@\S+\.\S+$/, 'Invalid email'],
    },
    passwordHash: {
        type: String,
        required: [true, 'Password is required'],
        minlength: 6,
        select: false,
    },
    avatar: { type: String, default: '' },
    currency: { type: String, default: 'INR', enum: ['INR', 'USD', 'EUR', 'GBP', 'JPY'] },
    themePreference: { type: String, default: 'dark', enum: ['dark', 'light'] },
    monthlyIncomeEstimate: { type: Number, default: 0 },
    notificationPreferences: {
        email: { type: Boolean, default: false },
        push: { type: Boolean, default: true },
        budgetAlerts: { type: Boolean, default: true },
        weeklyReport: { type: Boolean, default: true },
        aiInsights: { type: Boolean, default: true },
    },
    resetPasswordToken: String,
    resetPasswordExpire: Date,
    otp: String,
    otpExpire: Date,
    isVerified: { type: Boolean, default: false },
    lastLoginAt: Date,
}, {
    timestamps: true,
});

// Hash password before save
userSchema.pre('save', async function (next) {
    if (!this.isModified('passwordHash')) return next();
    this.passwordHash = await bcrypt.hash(this.passwordHash, constants.bcryptSaltRounds);
    next();
});

// Compare password
userSchema.methods.comparePassword = async function (candidatePassword) {
    return bcrypt.compare(candidatePassword, this.passwordHash);
};

const User = mongoose.model('User', userSchema);
export default User;
