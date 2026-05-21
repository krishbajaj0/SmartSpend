import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Mail, Lock, ArrowRight, Check, Eye, EyeOff } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import Input from '../components/ui/Input';
import Button from '../components/ui/Button';
import ParallaxOrbs from '../components/ParallaxOrbs';
import GoogleSignInButton from '../components/auth/GoogleSignInButton';
import './LoginPage.css';

export default function LoginPage() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [loading, setLoading] = useState(false);
    const [demoLoading, setDemoLoading] = useState(false);
    const [success, setSuccess] = useState(false);
    const [errors, setErrors] = useState({});
    const { login, loginWithGoogle, loadDemo } = useAuth();
    const { error: showError, success: showSuccess } = useToast();
    const navigate = useNavigate();

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
        if (loading || demoLoading) return;
        if (!validatePassword()) return;
        setLoading(true);
        try {
            await login(email, password);
            setSuccess(true);
            showSuccess('Welcome back!');
            setTimeout(() => navigate('/dashboard'), 600);
        } catch (err) {
            if (err.response?.status === 403) {
                setErrors({ email: 'Email not verified. Please contact admin.' });
                showError('Email not verified');
            } else {
                setErrors({ email: 'Invalid credentials' });
                showError('Invalid credentials');
            }
        } finally {
            setLoading(false);
        }
    };

    // ── Google Login ──
    const handleGoogleSuccess = async (credentialResponse) => {
        if (loading || demoLoading) return;
        setLoading(true);
        try {
            await loginWithGoogle(credentialResponse.credential);
            setSuccess(true);
            showSuccess('Successfully signed in with Google!');
            setTimeout(() => navigate('/dashboard'), 600);
        } catch (err) {
            showError(err.response?.data?.message || 'Google Sign-In failed');
        } finally {
            setLoading(false);
        }
    };

    const handleGoogleError = () => {
        showError('Google authentication failed. Please try again.');
    };

    // ── Demo Account Tour ──
    const handleDemoLogin = async () => {
        if (loading || demoLoading) return;
        setDemoLoading(true);
        try {
            await loadDemo();
            setSuccess(true);
            showSuccess('Explore mode activated!');
            setTimeout(() => navigate('/dashboard'), 600);
        } catch (err) {
            showError(err.response?.data?.message || 'Failed to load demo account. Please try again.');
        } finally {
            setDemoLoading(false);
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
                        Spend smarter. Save better. Stay in control.
                    </p>
                </div>
                <div className="auth-form-header" style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
                    <h2 style={{ fontSize: '1.6rem' }}>Welcome back</h2>
                    <p className="text-muted">Sign in to your account</p>
                </div>

                <form onSubmit={handlePasswordSubmit} className="auth-form">
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

                    <Button
                        type="submit"
                        variant="primary"
                        fullWidth
                        loading={loading}
                        disabled={demoLoading}
                        iconRight={success ? <Check size={18} /> : <ArrowRight size={18} />}
                        className={success ? 'btn-success-state' : ''}
                    >
                        {success ? 'Success!' : 'Sign In'}
                    </Button>

                    <Button
                        type="button"
                        onClick={handleDemoLogin}
                        fullWidth
                        loading={demoLoading}
                        disabled={loading || demoLoading}
                        className={`btn-demo ${success ? 'btn-success-state' : ''}`}
                        style={{ marginTop: '0.75rem' }}
                        iconRight={success ? <Check size={18} /> : <span>⚡</span>}
                    >
                        {success ? 'Activated!' : 'Explore Demo Account'}
                    </Button>
                </form>

                {/* Elegant continue with Google divider */}
                <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    margin: '24px 0 16px 0',
                    color: 'var(--text-secondary, #94a3b8)',
                    fontSize: '0.85rem'
                }}>
                    <div style={{ flex: 1, height: '1px', background: 'rgba(255, 255, 255, 0.08)' }} />
                    <span>or continue with</span>
                    <div style={{ flex: 1, height: '1px', background: 'rgba(255, 255, 255, 0.08)' }} />
                </div>

                {/* Google Sign-in CTA */}
                <GoogleSignInButton
                    onSuccess={handleGoogleSuccess}
                    onError={handleGoogleError}
                    loading={loading}
                    label="continue"
                />

                <motion.p
                    className="auth-switch"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.4 }}
                    style={{ marginTop: '2rem', textAlign: 'center' }}
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
