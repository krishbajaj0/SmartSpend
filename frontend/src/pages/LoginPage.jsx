import { useState, useRef, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Mail, Lock, ArrowRight, Check, Smartphone, KeyRound, RefreshCw, Eye, EyeOff } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import Input from '../components/ui/Input';
import Button from '../components/ui/Button';
import ParallaxOrbs from '../components/ParallaxOrbs';
import './LoginPage.css';

export default function LoginPage() {
    const [loginMode, setLoginMode] = useState('password'); // 'password' | 'otp'
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [otpStep, setOtpStep] = useState('email'); // 'email' | 'code'
    const [otpDigits, setOtpDigits] = useState(['', '', '', '', '', '']);
    const [loading, setLoading] = useState(false);
    const [success, setSuccess] = useState(false);
    const [errors, setErrors] = useState({});
    const [resendTimer, setResendTimer] = useState(0);
    const otpRefs = useRef([]);
    const { login, requestLoginOtp, loginWithOtp } = useAuth();
    const { error: showError, success: showSuccess } = useToast();
    const navigate = useNavigate();

    // Resend timer countdown
    useEffect(() => {
        if (resendTimer <= 0) return;
        const interval = setInterval(() => {
            setResendTimer(prev => prev - 1);
        }, 1000);
        return () => clearInterval(interval);
    }, [resendTimer]);

    const validateEmail = () => {
        const errs = {};
        if (!email) errs.email = 'Email is required';
        else if (!/\S+@\S+\.\S+/.test(email)) errs.email = 'Invalid email';
        setErrors(errs);
        return Object.keys(errs).length === 0;
    };

    const validatePassword = () => {
        const errs = {};
        if (!email) errs.email = 'Email is required';
        else if (!/\S+@\S+\.\S+/.test(email)) errs.email = 'Invalid email';
        if (!password) errs.password = 'Password is required';
        else if (password.length < 6) errs.password = 'Min 6 characters';
        setErrors(errs);
        return Object.keys(errs).length === 0;
    };

    // ── Password Login ──
    const handlePasswordSubmit = async (e) => {
        e.preventDefault();
        if (!validatePassword()) return;
        setLoading(true);
        try {
            await login(email, password);
            setSuccess(true);
            setTimeout(() => navigate('/dashboard'), 600);
        } catch (err) {
            if (err.response?.status === 403) {
                setErrors({ email: 'Email not verified. Please check your inbox or register again.' });
                showError('Email not verified');
            } else {
                setErrors({ email: 'Invalid credentials' });
            }
        } finally {
            setLoading(false);
        }
    };

    // ── OTP: Request Code ──
    const handleRequestOtp = async (e) => {
        e.preventDefault();
        if (!validateEmail()) return;
        setLoading(true);
        try {
            await requestLoginOtp(email);
            setOtpStep('code');
            setResendTimer(60);
            showSuccess('OTP sent to your email!');
            setErrors({});
            // Focus first OTP input after transition
            setTimeout(() => otpRefs.current[0]?.focus(), 300);
        } catch (err) {
            if (err.response?.status === 404) {
                setErrors({ email: 'No account found with that email' });
            } else if (err.response?.status === 403) {
                setErrors({ email: 'Email not verified. Please register again.' });
            } else {
                setErrors({ email: err.response?.data?.message || 'Failed to send OTP' });
            }
        } finally {
            setLoading(false);
        }
    };

    // ── OTP: Verify Code ──
    const handleVerifyOtp = async (otpCode) => {
        setLoading(true);
        try {
            await loginWithOtp(email, otpCode);
            setSuccess(true);
            setTimeout(() => navigate('/dashboard'), 600);
        } catch (err) {
            setErrors({ otp: err.response?.data?.message || 'Invalid or expired OTP' });
            showError('Invalid OTP');
            setOtpDigits(['', '', '', '', '', '']);
            setTimeout(() => otpRefs.current[0]?.focus(), 100);
        } finally {
            setLoading(false);
        }
    };

    // ── OTP: Resend ──
    const handleResendOtp = async () => {
        if (resendTimer > 0) return;
        setLoading(true);
        try {
            await requestLoginOtp(email);
            setResendTimer(60);
            showSuccess('OTP resent!');
            setOtpDigits(['', '', '', '', '', '']);
            setErrors({});
        } catch {
            showError('Failed to resend OTP');
        } finally {
            setLoading(false);
        }
    };

    // ── OTP Input Handlers ──
    const handleOtpChange = (index, value) => {
        if (!/^\d*$/.test(value)) return; // digits only
        const newDigits = [...otpDigits];
        newDigits[index] = value.slice(-1); // take last char
        setOtpDigits(newDigits);

        // Auto-advance to next input
        if (value && index < 5) {
            otpRefs.current[index + 1]?.focus();
        }

        // Auto-submit when all 6 digits entered
        const fullOtp = newDigits.join('');
        if (fullOtp.length === 6) {
            handleVerifyOtp(fullOtp);
        }
    };

    const handleOtpKeyDown = (index, e) => {
        if (e.key === 'Backspace' && !otpDigits[index] && index > 0) {
            otpRefs.current[index - 1]?.focus();
        }
    };

    const handleOtpPaste = (e) => {
        e.preventDefault();
        const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
        if (!pasted) return;
        const newDigits = [...otpDigits];
        for (let i = 0; i < 6; i++) {
            newDigits[i] = pasted[i] || '';
        }
        setOtpDigits(newDigits);
        if (pasted.length === 6) {
            handleVerifyOtp(pasted);
        } else {
            otpRefs.current[pasted.length]?.focus();
        }
    };

    // ── Mode Switch ──
    const switchMode = (mode) => {
        if (mode === loginMode) return;
        setLoginMode(mode);
        setErrors({});
        setSuccess(false);
        setOtpStep('email');
        setOtpDigits(['', '', '', '', '', '']);
        setPassword('');
    };

    const contentVariants = {
        initial: { opacity: 0, y: 12 },
        animate: { opacity: 1, y: 0 },
        exit: { opacity: 0, y: -12 },
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
                    <h2 style={{ fontSize: '1.6rem' }}>Welcome back</h2>
                    <p className="text-muted">Sign in to your account</p>
                </div>

                {/* ── Login Mode Toggle ── */}
                <motion.div
                    className="login-mode-toggle"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.25 }}
                >
                    <button
                        type="button"
                        className={`login-mode-btn ${loginMode === 'password' ? 'active' : ''}`}
                        onClick={() => switchMode('password')}
                        id="login-mode-password"
                    >
                        <KeyRound size={16} />
                        <span>Password</span>
                    </button>
                    <button
                        type="button"
                        className={`login-mode-btn ${loginMode === 'otp' ? 'active' : ''}`}
                        onClick={() => switchMode('otp')}
                        id="login-mode-otp"
                    >
                        <Smartphone size={16} />
                        <span>OTP</span>
                    </button>
                    <div
                        className="login-mode-slider"
                        style={{ transform: loginMode === 'otp' ? 'translateX(100%)' : 'translateX(0)' }}
                    />
                </motion.div>

                <AnimatePresence mode="wait">
                    {/* ═══ PASSWORD MODE ═══ */}
                    {loginMode === 'password' && (
                        <motion.form
                            key="password-form"
                            onSubmit={handlePasswordSubmit}
                            className="auth-form"
                            variants={contentVariants}
                            initial="initial"
                            animate="animate"
                            exit="exit"
                            transition={{ duration: 0.25 }}
                        >
                            <div>
                                <Input
                                    label="Email"
                                    type="email"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    icon={<Mail size={18} />}
                                    error={errors.email}
                                    placeholder="you@example.com"
                                />
                            </div>
                            <div>
                                <Input
                                    label="Password"
                                    type={showPassword ? 'text' : 'password'}
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    icon={<Lock size={18} />}
                                    error={errors.password}
                                    placeholder="••••••••"
                                    action={
                                        <button
                                            type="button"
                                            onClick={() => setShowPassword(!showPassword)}
                                            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'inherit', display: 'flex' }}
                                            tabIndex="-1"
                                            aria-label={showPassword ? "Hide password" : "Show password"}
                                        >
                                            {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                                        </button>
                                    }
                                />
                            </div>
                            <div className="auth-form-options">
                                <Link to="/forgot-password" className="auth-forgot-link">
                                    Forgot password?
                                </Link>
                            </div>
                            <Button
                                type="submit"
                                variant="primary"
                                fullWidth
                                loading={loading}
                                iconRight={success ? <Check size={18} /> : <ArrowRight size={18} />}
                                className={success ? 'btn-success-state' : ''}
                            >
                                {success ? 'Success!' : 'Sign In'}
                            </Button>
                        </motion.form>
                    )}

                    {/* ═══ OTP MODE ═══ */}
                    {loginMode === 'otp' && (
                        <motion.div
                            key="otp-form"
                            variants={contentVariants}
                            initial="initial"
                            animate="animate"
                            exit="exit"
                            transition={{ duration: 0.25 }}
                        >
                            <AnimatePresence mode="wait">
                                {/* ── Step 1: Enter Email ── */}
                                {otpStep === 'email' && (
                                    <motion.form
                                        key="otp-email"
                                        onSubmit={handleRequestOtp}
                                        className="auth-form"
                                        variants={contentVariants}
                                        initial="initial"
                                        animate="animate"
                                        exit="exit"
                                        transition={{ duration: 0.2 }}
                                    >
                                        <p className="otp-description">
                                            We'll send a 6-digit code to your email to sign you in — no password needed.
                                        </p>
                                        <div>
                                            <Input
                                                label="Email"
                                                type="email"
                                                value={email}
                                                onChange={(e) => setEmail(e.target.value)}
                                                icon={<Mail size={18} />}
                                                error={errors.email}
                                                placeholder="you@example.com"
                                            />
                                        </div>
                                        <Button
                                            type="submit"
                                            variant="primary"
                                            fullWidth
                                            loading={loading}
                                            iconRight={<ArrowRight size={18} />}
                                        >
                                            Send OTP
                                        </Button>
                                    </motion.form>
                                )}

                                {/* ── Step 2: Enter OTP ── */}
                                {otpStep === 'code' && (
                                    <motion.div
                                        key="otp-code"
                                        className="auth-form"
                                        variants={contentVariants}
                                        initial="initial"
                                        animate="animate"
                                        exit="exit"
                                        transition={{ duration: 0.2 }}
                                    >
                                        <div className="otp-sent-info">
                                            <Mail size={16} className="otp-sent-icon" />
                                            <span>Code sent to <strong>{email}</strong></span>
                                        </div>
                                        <div className="otp-inputs-wrapper">
                                            <div className="otp-inputs" onPaste={handleOtpPaste}>
                                                {otpDigits.map((digit, i) => (
                                                    <input
                                                        key={i}
                                                        ref={el => otpRefs.current[i] = el}
                                                        type="text"
                                                        inputMode="numeric"
                                                        maxLength={1}
                                                        className={`otp-digit-input ${digit ? 'filled' : ''} ${errors.otp ? 'error' : ''}`}
                                                        value={digit}
                                                        onChange={(e) => handleOtpChange(i, e.target.value)}
                                                        onKeyDown={(e) => handleOtpKeyDown(i, e)}
                                                        autoComplete="one-time-code"
                                                        id={`login-otp-digit-${i}`}
                                                    />
                                                ))}
                                            </div>
                                            {errors.otp && (
                                                <motion.p
                                                    className="otp-error"
                                                    initial={{ opacity: 0, y: -5 }}
                                                    animate={{ opacity: 1, y: 0 }}
                                                >
                                                    {errors.otp}
                                                </motion.p>
                                            )}
                                        </div>

                                        <Button
                                            type="button"
                                            variant="primary"
                                            fullWidth
                                            loading={loading}
                                            onClick={() => handleVerifyOtp(otpDigits.join(''))}
                                            disabled={otpDigits.join('').length < 6}
                                            iconRight={success ? <Check size={18} /> : <ArrowRight size={18} />}
                                            className={success ? 'btn-success-state' : ''}
                                        >
                                            {success ? 'Success!' : 'Verify & Sign In'}
                                        </Button>

                                        <div className="otp-actions">
                                            <button
                                                type="button"
                                                className="otp-resend-btn"
                                                onClick={handleResendOtp}
                                                disabled={resendTimer > 0 || loading}
                                            >
                                                <RefreshCw size={14} className={loading ? 'spin' : ''} />
                                                {resendTimer > 0 ? `Resend in ${resendTimer}s` : 'Resend code'}
                                            </button>
                                            <button
                                                type="button"
                                                className="otp-change-email-btn"
                                                onClick={() => { setOtpStep('email'); setErrors({}); setOtpDigits(['', '', '', '', '', '']); }}
                                            >
                                                Change email
                                            </button>
                                        </div>
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </motion.div>
                    )}
                </AnimatePresence>

                <motion.p
                    className="auth-switch"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.6 }}
                >
                    Don't have an account?{' '}
                    <Link to="/register" className="auth-switch-link">
                        Create account
                    </Link>
                </motion.p>
            </motion.div>
        </div>
    );
}

