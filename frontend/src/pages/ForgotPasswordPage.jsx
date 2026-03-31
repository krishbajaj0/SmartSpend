import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Mail, ArrowLeft, Send, Lock, ShieldCheck, CheckCircle2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import Input from '../components/ui/Input';
import Button from '../components/ui/Button';
import { useToast } from '../context/ToastContext';
import './LoginPage.css';

export default function ForgotPasswordPage() {
    const [step, setStep] = useState(1); // 1: Email, 2: OTP & New PW, 3: Success
    const [email, setEmail] = useState('');
    const [otp, setOtp] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [errorMsg, setErrorMsg] = useState('');
    
    const { forgotPassword, resetPassword } = useAuth();
    const { success, error } = useToast();
    const navigate = useNavigate();

    const handleSendOtp = async (e) => {
        e.preventDefault();
        if (!email || !/\S+@\S+\.\S+/.test(email)) {
            error('Please enter a valid email');
            return;
        }
        setLoading(true);
        try {
            await forgotPassword(email);
            setStep(2);
            success('OTP sent to your email');
        } catch (err) {
            error(err.response?.data?.message || 'Failed to send OTP');
        } finally {
            setLoading(false);
        }
    };

    const handleReset = async (e) => {
        e.preventDefault();
        if (!otp || otp.length !== 6) {
            error('Please enter a Valid 6-digit OTP');
            return;
        }
        if (!newPassword || newPassword.length < 6) {
            error('Password must be at least 6 characters');
            return;
        }
        if (newPassword !== confirmPassword) {
            error('Passwords do not match');
            return;
        }

        setLoading(true);
        try {
            await resetPassword(email, otp, newPassword);
            setStep(3);
            success('Password reset successful');
        } catch (err) {
            error(err.response?.data?.message || 'Failed to reset password');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="auth-page">
            <div className="auth-bg">
                <div className="auth-noise" />
            </div>

                <motion.div
                    className="auth-form-card glass"
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ duration: 0.5 }}
                    style={{ maxWidth: 440 }}
                >
                    <AnimatePresence mode="wait">
                        {step === 1 && (
                            <motion.div
                                key="step1"
                                initial={{ opacity: 0, x: -20 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: 20 }}
                            >
                                <div className="auth-form-header" style={{ textAlign: 'center' }}>
                                    <div className="otp-icon-wrapper" style={{ margin: '0 auto 20px' }}>
                                        <Mail size={32} />
                                    </div>
                                    <h2>Forgot Password?</h2>
                                    <p className="text-muted">
                                        Enter your email and we'll send you a 6-digit OTP to reset your password.
                                    </p>
                                </div>
                                <form onSubmit={handleSendOtp} className="auth-form">
                                    <Input
                                        label="Email"
                                        type="email"
                                        value={email}
                                        onChange={(e) => setEmail(e.target.value)}
                                        icon={<Mail size={18} />}
                                        placeholder="you@example.com"
                                    />
                                    <Button
                                        type="submit"
                                        variant="primary"
                                        fullWidth
                                        loading={loading}
                                        iconRight={<Send size={16} />}
                                    >
                                        Send OTP
                                    </Button>
                                </form>
                            </motion.div>
                        )}

                        {step === 2 && (
                            <motion.div
                                key="step2"
                                initial={{ opacity: 0, x: 20 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: -20 }}
                            >
                                <div className="auth-form-header" style={{ textAlign: 'center' }}>
                                    <div className="otp-icon-wrapper" style={{ margin: '0 auto 20px' }}>
                                        <ShieldCheck size={32} />
                                    </div>
                                    <h2>Reset Password</h2>
                                    <p className="text-muted">
                                        Enter the 6-digit code sent to <strong>{email}</strong> and your new password.
                                    </p>
                                </div>
                                <form onSubmit={handleReset} className="auth-form">
                                    <Input
                                        label="Verification Code (OTP)"
                                        type="text"
                                        value={otp}
                                        onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                                        icon={<ShieldCheck size={18} />}
                                        placeholder="123456"
                                        maxLength={6}
                                    />
                                    <Input
                                        label="New Password"
                                        type="password"
                                        value={newPassword}
                                        onChange={(e) => setNewPassword(e.target.value)}
                                        icon={<Lock size={18} />}
                                        placeholder="Min 6 characters"
                                    />
                                    <Input
                                        label="Confirm New Password"
                                        type="password"
                                        value={confirmPassword}
                                        onChange={(e) => setConfirmPassword(e.target.value)}
                                        icon={<Lock size={18} />}
                                        placeholder="Repeat new password"
                                    />
                                    <Button
                                        type="submit"
                                        variant="primary"
                                        fullWidth
                                        loading={loading}
                                    >
                                        Reset Password
                                    </Button>
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        fullWidth
                                        onClick={() => setStep(1)}
                                        disabled={loading}
                                        style={{ marginTop: '10px' }}
                                    >
                                        Back
                                    </Button>
                                </form>
                            </motion.div>
                        )}

                        {step === 3 && (
                            <motion.div
                                key="step3"
                                initial={{ opacity: 0, scale: 0.9 }}
                                animate={{ opacity: 1, scale: 1 }}
                                style={{ textAlign: 'center' }}
                            >
                                <div className="otp-icon-wrapper" style={{ background: 'rgba(34, 197, 94, 0.1)', color: '#22c55e', margin: '0 auto 20px' }}>
                                    <CheckCircle2 size={32} />
                                </div>
                                <h2>Success!</h2>
                                <p className="text-muted" style={{ marginBottom: '25px' }}>
                                    Your password has been reset successfully. You can now log in with your new password.
                                </p>
                                <Button
                                    variant="primary"
                                    fullWidth
                                    onClick={() => navigate('/login')}
                                >
                                    Go to Login
                                </Button>
                            </motion.div>
                        )}
                    </AnimatePresence>

                    {step !== 3 && (
                        <p className="auth-switch">
                            <Link to="/login" className="auth-switch-link" style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                                <ArrowLeft size={14} /> Back to sign in
                            </Link>
                        </p>
                    )}
                </motion.div>
        </div>
    );
}
