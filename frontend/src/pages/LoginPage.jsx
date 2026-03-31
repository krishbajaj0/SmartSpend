import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Mail, Lock, ArrowRight, Check } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import Input from '../components/ui/Input';
import Button from '../components/ui/Button';
import ParallaxOrbs from '../components/ParallaxOrbs';
import './LoginPage.css';

export default function LoginPage() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [success, setSuccess] = useState(false);
    const [errors, setErrors] = useState({});
    const { login } = useAuth();
    const { error } = useToast();
    const navigate = useNavigate();

    const validate = () => {
        const errs = {};
        if (!email) errs.email = 'Email is required';
        else if (!/\S+@\S+\.\S+/.test(email)) errs.email = 'Invalid email';
        if (!password) errs.password = 'Password is required';
        else if (password.length < 6) errs.password = 'Min 6 characters';
        setErrors(errs);
        return Object.keys(errs).length === 0;
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!validate()) return;
        setLoading(true);
        try {
            await login(email, password);
            setSuccess(true);
            setTimeout(() => navigate('/dashboard'), 600);
        } catch (err) {
            if (err.response?.status === 403) {
                setErrors({ email: 'Email not verified. Please check your inbox or register again.' });
                error('Email not verified');
            } else {
                setErrors({ email: 'Invalid credentials' });
            }
        } finally {
            setLoading(false);
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
                        <h2 style={{ fontSize: '1.6rem' }}>Welcome back</h2>
                        <p className="text-muted">Sign in to your account</p>
                    </div>

                    <form onSubmit={handleSubmit} className="auth-form">
                        <motion.div
                            initial={{ opacity: 0, y: 15 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.3 }}
                        >
                            <Input
                                label="Email"
                                type="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                icon={<Mail size={18} />}
                                error={errors.email}
                                placeholder="you@example.com"
                            />
                        </motion.div>

                        <motion.div
                            initial={{ opacity: 0, y: 15 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.4 }}
                        >
                            <Input
                                label="Password"
                                type="password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                icon={<Lock size={18} />}
                                error={errors.password}
                                placeholder="••••••••"
                            />
                        </motion.div>

                        <motion.div
                            className="auth-form-options"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            transition={{ delay: 0.5 }}
                        >
                            <Link to="/forgot-password" className="auth-forgot-link">
                                Forgot password?
                            </Link>
                        </motion.div>

                        <motion.div
                            initial={{ opacity: 0, y: 15 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.5 }}
                        >
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
                        </motion.div>
                    </form>

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
