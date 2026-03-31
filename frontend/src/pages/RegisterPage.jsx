import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Mail, Lock, User, ArrowRight, ArrowLeft, Check } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import Input from '../components/ui/Input';
import Button from '../components/ui/Button';
import ParallaxOrbs from '../components/ParallaxOrbs';
import OTPVerification from '../components/auth/OTPVerification';
import { useToast } from '../context/ToastContext';
import './LoginPage.css';

function getPasswordStrength(pw) {
    if (!pw) return { score: 0, label: '' };
    let score = 0;
    if (pw.length >= 6) score++;
    if (pw.length >= 10) score++;
    if (/[A-Z]/.test(pw)) score++;
    if (/[0-9]/.test(pw)) score++;
    if (/[^A-Za-z0-9]/.test(pw)) score++;
    if (score <= 1) return { score: 1, label: 'Weak', level: 'weak' };
    if (score <= 3) return { score: 2, label: 'Medium', level: 'medium' };
    return { score: 3, label: 'Strong', level: 'strong' };
}

export default function RegisterPage() {
    const [step, setStep] = useState(1);
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [confirmEmail, setConfirmEmail] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [showOtp, setShowOtp] = useState(false);
    const [errors, setErrors] = useState({});
    const { register, verifyOtp, resendOtp } = useAuth();
    const { success, error } = useToast();
    const navigate = useNavigate();

    const strength = getPasswordStrength(password);

    const validateStep1 = () => {
        const errs = {};
        if (!name.trim()) errs.name = 'Name is required';
        if (!email) errs.email = 'Email is required';
        else if (!/\S+@\S+\.\S+/.test(email)) errs.email = 'Invalid email';
        
        if (!confirmEmail) errs.confirmEmail = 'Please confirm your email';
        else if (email !== confirmEmail) errs.confirmEmail = 'Emails do not match';
        
        setErrors(errs);
        return Object.keys(errs).length === 0;
    };

    const validateStep2 = () => {
        const errs = {};
        if (!password) errs.password = 'Password is required';
        else if (password.length < 6) errs.password = 'Min 6 characters';
        if (password !== confirmPassword) errs.confirmPassword = 'Passwords don\'t match';
        setErrors(errs);
        return Object.keys(errs).length === 0;
    };

    const handleNext = () => {
        if (validateStep1()) {
            setErrors({});
            setStep(2);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!validateStep2()) return;
        setLoading(true);
        try {
            await register(name, email, password);
            setShowOtp(true);
        } catch (err) {
            setErrors({ email: err.response?.data?.message || 'Registration failed' });
        } finally {
            setLoading(false);
        }
    };

    const handleVerifyOtp = async (otpValue) => {
        setLoading(true);
        try {
            await verifyOtp(email, otpValue);
            navigate('/dashboard');
        } catch (err) {
            error(err.response?.data?.message || 'Verification failed');
        } finally {
            setLoading(false);
        }
    };

    const handleResendOtp = async () => {
        try {
            await resendOtp(email);
            success('OTP resent successfully');
        } catch (err) {
            error(err.response?.data?.message || 'Failed to resend OTP');
        }
    };

    return (
        <div className="auth-page">
            <div className="auth-bg">
                <ParallaxOrbs />
                <div className="auth-noise" />
            </div>

            <motion.div
                className="auth-form-card glass"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.5, delay: 0.2 }}
            >
                    <div className="auth-brand-header" style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
                        <span className="auth-brand-icon" style={{ fontSize: '2.5rem', display: 'inline-block', marginBottom: '0.5rem' }}>💰</span>
                        <h1 className="auth-brand-title" style={{ fontSize: '2.2rem', margin: 0, fontWeight: 800 }}>
                            <span className="text-gradient">SmartSpend</span>
                        </h1>
                        <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginTop: '0.75rem', lineHeight: '1.5', padding: '0 1rem' }}>
                            An expense management platform with intelligent categorization, budget alerts, receipt handling, and analytics.
                        </p>
                    </div>
                    <div className="auth-form-header" style={{ textAlign: 'center' }}>
                        <h2 style={{ fontSize: '1.6rem' }}>Create account</h2>
                        <p className="text-muted">Start tracking your expenses</p>
                    </div>

                    {/* Step indicator */}
                    <div className="auth-steps">
                        <div className={`auth-step ${step >= 1 ? 'active' : ''} ${step > 1 ? 'completed' : ''}`}>
                            {step > 1 ? <Check size={14} /> : '1'}
                        </div>
                        <div className={`auth-step-line ${step > 1 ? 'active' : ''}`} />
                        <div className={`auth-step ${step >= 2 ? 'active' : ''}`}>2</div>
                    </div>

                    <form onSubmit={handleSubmit} className="auth-form">
                        <AnimatePresence mode="wait">
                            {step === 1 && (
                                <motion.div
                                    key="step1"
                                    className="auth-form"
                                    initial={{ opacity: 0, x: -20 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    exit={{ opacity: 0, x: 20 }}
                                    transition={{ duration: 0.25 }}
                                >
                                    <Input
                                        label="Full Name"
                                        value={name}
                                        onChange={(e) => setName(e.target.value)}
                                        icon={<User size={18} />}
                                        error={errors.name}
                                        placeholder="John Doe"
                                    />
                                    <Input
                                        label="Email"
                                        type="email"
                                        value={email}
                                        onChange={(e) => setEmail(e.target.value)}
                                        icon={<Mail size={18} />}
                                        error={errors.email}
                                        placeholder="you@example.com"
                                    />
                                    <Input
                                        label="Confirm Email"
                                        type="email"
                                        value={confirmEmail}
                                        onChange={(e) => setConfirmEmail(e.target.value)}
                                        icon={<Mail size={18} />}
                                        error={errors.confirmEmail}
                                        placeholder="Re-enter your email"
                                    />
                                    <Button
                                        type="button"
                                        variant="primary"
                                        fullWidth
                                        iconRight={<ArrowRight size={18} />}
                                        onClick={handleNext}
                                    >
                                        Continue
                                    </Button>
                                </motion.div>
                            )}

                            {step === 2 && (
                                <motion.div
                                    key="step2"
                                    className="auth-form"
                                    initial={{ opacity: 0, x: 20 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    exit={{ opacity: 0, x: -20 }}
                                    transition={{ duration: 0.25 }}
                                >
                                    <Input
                                        label="Password"
                                        type="password"
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        icon={<Lock size={18} />}
                                        error={errors.password}
                                        placeholder="Min 6 characters"
                                    />
                                    {password && (
                                        <>
                                            <div className="password-strength">
                                                {[1, 2, 3].map(i => (
                                                    <div
                                                        key={i}
                                                        className={`password-strength-bar ${strength.score >= i ? `active-${strength.level}` : ''}`}
                                                    />
                                                ))}
                                            </div>
                                            <span className={`password-strength-label text-xs`} style={{ color: strength.level === 'weak' ? 'var(--danger)' : strength.level === 'medium' ? 'var(--warning)' : 'var(--success)' }}>
                                                {strength.label}
                                            </span>
                                        </>
                                    )}
                                    <Input
                                        label="Confirm Password"
                                        type="password"
                                        value={confirmPassword}
                                        onChange={(e) => setConfirmPassword(e.target.value)}
                                        icon={<Lock size={18} />}
                                        error={errors.confirmPassword}
                                        placeholder="Re-enter password"
                                    />
                                    <div style={{ display: 'flex', gap: 'var(--space-md)' }}>
                                        <Button
                                            type="button"
                                            variant="ghost"
                                            icon={<ArrowLeft size={18} />}
                                            onClick={() => { setStep(1); setErrors({}); }}
                                        >
                                            Back
                                        </Button>
                                        <Button
                                            type="submit"
                                            variant="primary"
                                            fullWidth
                                            loading={loading}
                                            iconRight={<ArrowRight size={18} />}
                                        >
                                            Create Account
                                        </Button>
                                    </div>
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </form>

                    <p className="auth-switch">
                        Already have an account?{' '}
                        <Link to="/login" className="auth-switch-link">Sign in</Link>
                    </p>
            </motion.div>

            {showOtp && (
                <OTPVerification
                    email={email}
                    onVerify={handleVerifyOtp}
                    onResend={handleResendOtp}
                    onCancel={() => setShowOtp(false)}
                    isLoading={loading}
                />
            )}
        </div>
    );
}
