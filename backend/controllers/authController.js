import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import User from '../models/User.js';
import { AppError } from '../middleware/errorHandler.js';
import constants from '../config/constants.js';
import { sendOtpEmail } from '../services/emailService.js';

function signToken(id) {
    return jwt.sign({ id }, constants.jwtSecret, { expiresIn: constants.jwtExpire });
}

// POST /api/auth/register
export async function register(req, res, next) {
    try {
        const { name, email, password } = req.body;

        const exists = await User.findOne({ email });
        if (exists) throw new AppError('Email already registered', 409);

        // Generate 6-digit OTP
        const otp = Math.floor(100000 + Math.random() * 900000).toString();
        const otpExpire = Date.now() + 10 * 60 * 1000; // 10 mins

        const user = await User.create({
            name,
            email,
            passwordHash: password,
            otp,
            otpExpire,
            isVerified: false
        });

        await sendOtpEmail(email, otp);

        res.status(201).json({
            success: true,
            message: 'Registration successful. Please verify your email with the OTP sent.',
            email: user.email
        });
    } catch (err) { next(err); }
}

// POST /api/auth/login
export async function login(req, res, next) {
    try {
        const { email, password } = req.body;

        const user = await User.findOne({ email }).select('+passwordHash');
        if (!user) throw new AppError('Invalid credentials', 401);

        const isMatch = await user.comparePassword(password);
        if (!isMatch) throw new AppError('Invalid credentials', 401);

        if (!user.isVerified) {
            throw new AppError('Please verify your email first', 403);
        }

        user.lastLoginAt = new Date();
        await user.save({ validateBeforeSave: false });

        const token = signToken(user._id);

        res.json({
            success: true,
            token,
            user: { id: user._id, name: user.name, email: user.email, currency: user.currency, avatar: user.avatar },
        });
    } catch (err) { next(err); }
}

// GET /api/auth/me
export async function getMe(req, res) {
    res.json({ success: true, user: req.user });
}

// PUT /api/auth/profile
export async function updateProfile(req, res, next) {
    try {
        const allowed = ['name', 'avatar', 'currency', 'monthlyIncomeEstimate', 'themePreference', 'notificationPreferences'];
        const updates = {};
        for (const key of allowed) {
            if (req.body[key] !== undefined) updates[key] = req.body[key];
        }
        const user = await User.findByIdAndUpdate(req.user._id, updates, { new: true, runValidators: true });
        res.json({ success: true, user });
    } catch (err) { next(err); }
}

// PUT /api/auth/change-password
export async function changePassword(req, res, next) {
    try {
        const { oldPassword, newPassword } = req.body;
        const user = await User.findById(req.user._id).select('+passwordHash');

        const isMatch = await user.comparePassword(oldPassword);
        if (!isMatch) throw new AppError('Current password is incorrect', 400);

        user.passwordHash = newPassword;
        await user.save();

        res.json({ success: true, message: 'Password updated' });
    } catch (err) { next(err); }
}

// POST /api/auth/forgot-password
export async function forgotPassword(req, res, next) {
    try {
        const user = await User.findOne({ email: req.body.email });
        if (!user) throw new AppError('No user with that email', 404);

        // Generate 6-digit OTP for password reset
        const otp = Math.floor(100000 + Math.random() * 900000).toString();
        user.otp = otp;
        user.otpExpire = Date.now() + 10 * 60 * 1000; // 10 mins
        await user.save({ validateBeforeSave: false });

        await sendOtpEmail(user.email, otp);

        res.json({ success: true, message: 'OTP sent to your email' });
    } catch (err) { next(err); }
}

// POST /api/auth/reset-password
export async function resetPassword(req, res, next) {
    try {
        const { email, otp, newPassword } = req.body;

        const user = await User.findOne({
            email,
            otp,
            otpExpire: { $gt: Date.now() },
        });

        if (!user) throw new AppError('Invalid or expired OTP', 400);

        user.passwordHash = newPassword;
        user.otp = undefined;
        user.otpExpire = undefined;
        user.isVerified = true; // Mark as verified if they reset password
        await user.save();

        res.json({ success: true, message: 'Password reset successful' });
    } catch (err) { next(err); }
}

// POST /api/auth/verify-otp
export async function verifyOtp(req, res, next) {
    try {
        const { email, otp } = req.body;

        const user = await User.findOne({
            email,
            otp,
            otpExpire: { $gt: Date.now() },
        });

        if (!user) throw new AppError('Invalid or expired OTP', 400);

        user.isVerified = true;
        user.otp = undefined;
        user.otpExpire = undefined;
        await user.save({ validateBeforeSave: false });

        const token = signToken(user._id);

        res.json({
            success: true,
            message: 'Email verified successfully',
            token,
            user: { id: user._id, name: user.name, email: user.email, currency: user.currency },
        });
    } catch (err) { next(err); }
}

// POST /api/auth/resend-otp
export async function resendOtp(req, res, next) {
    try {
        const { email } = req.body;
        const user = await User.findOne({ email });
        if (!user) throw new AppError('User not found', 404);

        const otp = Math.floor(100000 + Math.random() * 900000).toString();
        user.otp = otp;
        user.otpExpire = Date.now() + 10 * 60 * 1000;
        await user.save({ validateBeforeSave: false });

        await sendOtpEmail(email, otp);

        res.json({ success: true, message: 'OTP resent to your email' });
    } catch (err) { next(err); }
}
