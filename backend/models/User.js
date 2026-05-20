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
 *  - Google OAuth users receive a random `passwordHash` so the schema stays
 *    consistent; they authenticate only via Google credential verification.
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
            required: false,      // Optional — Google OAuth users get a random hash
            minlength: 6,
            select: false,        // Never returned by default — must opt in with .select('+passwordHash')
        },
        avatar: { type: String, default: '' },

        // Auth provider: 'local' = email/password, 'google' = Google OAuth
        provider: {
            type: String,
            enum: ['local', 'google'],
            default: 'local',
        },
        // Google OAuth subject identifier (sub claim from ID token)
        googleId: {
            type: String,
            sparse: true,         // Sparse index: allows multiple null values
        },
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

        isVerified:  { type: Boolean, default: false },
        emailVerifiedAt: Date,
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
// googleId sparse index is created by `sparse: true` above.

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
