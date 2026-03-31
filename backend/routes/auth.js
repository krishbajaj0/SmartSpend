import express from 'express';
import { register, login, getMe, updateProfile, changePassword, forgotPassword, resetPassword, verifyOtp, resendOtp } from '../controllers/authController.js';
import { protect } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import rateLimit from 'express-rate-limit';
import constants from '../config/constants.js';

const router = express.Router();

const authLimiter = rateLimit({
    windowMs: constants.rateLimit.auth.windowMs,
    max: constants.rateLimit.auth.max,
    message: { success: false, message: 'Too many auth attempts' },
});

router.post('/register', authLimiter, validate({
    name: { required: true, type: 'string', minLength: 2 },
    email: { required: true, type: 'email' },
    password: { required: true, type: 'string', minLength: 6 },
}), register);

router.post('/login', authLimiter, validate({
    email: { required: true, type: 'email' },
    password: { required: true, type: 'string' },
}), login);

router.get('/me', protect, getMe);
router.put('/profile', protect, updateProfile);
router.put('/change-password', protect, validate({
    oldPassword: { required: true, type: 'string' },
    newPassword: { required: true, type: 'string', minLength: 6 },
}), changePassword);

router.post('/forgot-password', authLimiter, validate({
    email: { required: true, type: 'email' },
}), forgotPassword);

router.post('/reset-password', authLimiter, validate({
    email: { required: true, type: 'email' },
    otp: { required: true, type: 'string', minLength: 6, maxLength: 6 },
    newPassword: { required: true, type: 'string', minLength: 6 },
}), resetPassword);

router.post('/verify-otp', authLimiter, validate({
    email: { required: true, type: 'email' },
    otp: { required: true, type: 'string', minLength: 6, maxLength: 6 },
}), verifyOtp);

router.post('/resend-otp', authLimiter, validate({
    email: { required: true, type: 'email' },
}), resendOtp);

export default router;
