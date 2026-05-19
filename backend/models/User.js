/**
 * @file models/User.js
 *
 * Production decisions:
 *  - `passwordHash` is `select: false` — never returned in queries unless
 *    explicitly requested with `.select('+passwordHash')`.
 *  - `tokenVersion` is `select: false` — embedded in JWT payload for
 *    revocation. Incrementing it invalidates all active sessions for that user.
 *    Must be explicitly selected with `.select('+tokenVersion')` when needed.
 *  - `toJSON` transform strips all sensitive fields. Defence-in-depth: even if
 *    a controller accidentally calls res.json(user), no secrets leak.
 *  - Partial index on { email, otpExpire } keeps OTP lookups fast without
 *    indexing documents that have no active OTP.
 *  - `comparePassword` is an instance method because it operates on a single
 *    document's hash.
 */

import mongoose from 'mongoose';
import bcrypt from 'bcrypt';
import constants from '../config/constants.js';

const userSchema = new mongoose.Schema(
    {
        name: {
            type: String,
            required: [true, 'Name is required'],
            trim: true,
            maxlength: [100, 'Name must not exceed 100 characters'],
        },
        email: {
            type: String,
            required: [true, 'Email is required'],
            unique: true,           // Creates an index automatically
            lowercase: true,
            trim: true,
            // RFC-5322 simplified pattern — tight enough to reject obvious garbage
            match: [/^[^\s@]+@[^\s@]+\.[^\s@]+$/, 'Invalid email address'],
        },
        passwordHash: {
            type: String,
            required: [true, 'Password is required'],
            minlength: 6,
            select: false,          // Never returned by default — must opt in with .select('+passwordHash')
        },
        avatar: { type: String, default: '' },
        currency: {
            type: String,
            default: 'INR',
            enum: {
                values: ['INR', 'USD', 'EUR', 'GBP', 'JPY'],
                message: '{VALUE} is not a supported currency',
            },
        },
        themePreference: {
            type: String,
            default: 'dark',
            enum: ['dark', 'light'],
        },
        monthlyIncomeEstimate: { type: Number, default: 0, min: 0 },
        notificationPreferences: {
            email:        { type: Boolean, default: false },
            push:         { type: Boolean, default: true },
            budgetAlerts: { type: Boolean, default: true },
            weeklyReport: { type: Boolean, default: true },
            aiInsights:   { type: Boolean, default: true },
        },

        // Password reset — stored hashed in a real app; kept as String here
        // because the token is already a cryptographically random value.
        resetPasswordToken:  String,
        resetPasswordExpire: Date,

        // OTP authentication — otp is stored as HMAC-SHA256 hash (see utils/otp.js)
        otp:         String,
        otpExpire:   Date,
        otpAttempts: { type: Number, default: 0, min: 0 },
        lastOtpSentAt: Date,
        otpLockUntil: Date,

        isVerified:  { type: Boolean, default: false },
        lastLoginAt: Date,

        // JWT revocation counter.
        // Embedded in every token as `tv`. On password change, forced logout,
        // or account compromise, increment this to invalidate all active tokens
        // for this user instantly — without affecting any other user's session.
        tokenVersion: { type: Number, default: 0, select: false },
    },
    {
        timestamps: true,
        // toJSON transform runs whenever Mongoose serialises this document.
        // It is a defence-in-depth measure: even if a controller accidentally
        // sends the whole user object, sensitive fields are stripped.
        toJSON: {
            transform(_doc, ret) {
                delete ret.passwordHash;
                delete ret.otp;
                delete ret.otpExpire;
                delete ret.otpAttempts;
                delete ret.lastOtpSentAt;
                delete ret.otpLockUntil;
                delete ret.resetPasswordToken;
                delete ret.resetPasswordExpire;
                delete ret.tokenVersion;   // Never expose the revocation counter
                delete ret.__v;
                return ret;
            },
        },
    }
);

// ── Indexes ───────────────────────────────────────────────────────────────────
// email unique index is created by `unique: true` above.

// Compound partial index for OTP verification (atomicVerifyOtp query pattern):
//   filter: { email, otp: hashedValue, otpExpire: { $gt: now }, otpAttempts: { $lt: 5 } }
//
// WHY COMPOUND: the query filters on all four fields simultaneously.
// A compound index on (email, otp, otpExpire, otpAttempts) lets MongoDB resolve
// the entire filter from the index without touching the document — a covered query.
//
// WHY PARTIAL: only documents that have an active OTP (otpExpire set) are indexed.
// The majority of users never have an active OTP. Without partialFilterExpression
// the index would bloat to the full collection size for a query that affects <1% of docs.
userSchema.index(
    { email: 1, otp: 1, otpExpire: 1, otpAttempts: 1 },
    { partialFilterExpression: { otpExpire: { $exists: true } } }
);

// ── Hooks ─────────────────────────────────────────────────────────────────────
// Hash the password before every save where passwordHash was modified.
// This fires on both create AND update (when calling save() on a document).
userSchema.pre('save', async function (next) {
    if (!this.isModified('passwordHash')) return next();
    this.passwordHash = await bcrypt.hash(this.passwordHash, constants.bcryptSaltRounds);
    next();
});

// ── Instance methods ──────────────────────────────────────────────────────────
/**
 * Compares a plaintext candidate password against the stored hash.
 * Must be called on a document fetched with `.select('+passwordHash')`.
 * @param {string} candidatePassword
 * @returns {Promise<boolean>}
 */
userSchema.methods.comparePassword = async function (candidatePassword) {
    return bcrypt.compare(candidatePassword, this.passwordHash);
};

const User = mongoose.model('User', userSchema);
export default User;
