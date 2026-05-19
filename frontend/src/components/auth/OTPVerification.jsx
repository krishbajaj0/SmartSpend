import React, { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import './OTPVerification.css';
import GlassCard from '../ui/GlassCard';
import Button from '../ui/Button';
import { ShieldCheck, RefreshCw, ArrowLeft, AlertTriangle } from 'lucide-react';
import { useToast } from '../../context/ToastContext';

/**
 * Production-grade OTP Verification Modal.
 *
 * Props:
 *   email          {string}  - The email address the OTP was sent to.
 *   purpose        {string}  - "register" | "login" | "forgot-password"
 *   onVerify       {fn}      - Called with (otpString) when the user submits.
 *   onResend       {fn}      - Called when the user clicks Resend.
 *   onCancel       {fn}      - Called when the user clicks the back arrow.
 *   isLoading      {bool}    - External loading state (e.g. during async verify).
 */
const OTPVerification = ({ email, purpose = 'register', onVerify, onResend, onCancel, isLoading }) => {
    const { error: showError } = useToast();
    const [otp, setOtp]                       = useState(['', '', '', '', '', '']);
    const [timer, setTimer]                   = useState(60);
    const [canResend, setCanResend]           = useState(false);
    const [attemptsRemaining, setAttemptsRemaining] = useState(null);
    const [submitting, setSubmitting]         = useState(false);
    const inputRefs = useRef([]);

    // ── Countdown timer ──────────────────────────────────────────────────────
    useEffect(() => {
        if (timer <= 0) {
            setCanResend(true);
            return;
        }
        const id = setInterval(() => setTimer(prev => prev - 1), 1000);
        return () => clearInterval(id);
    }, [timer]);

    // ── Auto-focus first input on mount ──────────────────────────────────────
    useEffect(() => {
        inputRefs.current[0]?.focus();
    }, []);

    // ── Input handlers ───────────────────────────────────────────────────────
    const handleChange = (index, value) => {
        // Only allow a single digit 0-9
        const digit = value.replace(/\D/g, '').slice(-1);
        const newOtp = [...otp];
        newOtp[index] = digit;
        setOtp(newOtp);
        // Auto-advance to next input
        if (digit && index < 5) {
            inputRefs.current[index + 1]?.focus();
        }
    };

    const handleKeyDown = (index, e) => {
        if (e.key === 'Backspace') {
            if (otp[index]) {
                // Clear current box
                const newOtp = [...otp];
                newOtp[index] = '';
                setOtp(newOtp);
            } else if (index > 0) {
                // Move to previous box
                inputRefs.current[index - 1]?.focus();
            }
        }
        // Allow navigation with arrow keys
        if (e.key === 'ArrowLeft' && index > 0) inputRefs.current[index - 1]?.focus();
        if (e.key === 'ArrowRight' && index < 5) inputRefs.current[index + 1]?.focus();
    };

    const handlePaste = (e) => {
        e.preventDefault();
        const data = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
        if (!data) return;
        const newOtp = ['', '', '', '', '', ''];
        data.split('').forEach((char, i) => { if (i < 6) newOtp[i] = char; });
        setOtp(newOtp);
        // Focus the next empty box, or the last filled one
        const nextEmpty = newOtp.findIndex(d => d === '');
        inputRefs.current[nextEmpty >= 0 ? nextEmpty : 5]?.focus();
    };

    // ── Submit ───────────────────────────────────────────────────────────────
    const handleSubmit = async (e) => {
        e.preventDefault();
        // Debounce: prevent rapid double-submits
        if (submitting || isLoading) return;
        const otpValue = otp.join('');
        if (otpValue.length !== 6) {
            showError('Please enter the complete 6-digit code');
            return;
        }
        setSubmitting(true);
        try {
            await onVerify(otpValue);
        } catch (err) {
            // Read attemptsRemaining from API error response if present
            const remaining = err?.response?.data?.attemptsRemaining;
            if (remaining !== undefined) {
                setAttemptsRemaining(remaining);
            }
            // Clear inputs and refocus first box on failure
            setOtp(['', '', '', '', '', '']);
            inputRefs.current[0]?.focus();
        } finally {
            setSubmitting(false);
        }
    };

    // ── Resend ───────────────────────────────────────────────────────────────
    const handleResend = async () => {
        if (!canResend || submitting || isLoading) return;
        setOtp(['', '', '', '', '', '']);
        setAttemptsRemaining(null);
        try {
            await onResend();
            // Reset timer to full 60 on successful resend
            setTimer(60);
            setCanResend(false);
        } catch (err) {
            // Server may return secondsLeft on 429 — use it for precise timer sync
            const secondsLeft = err?.response?.data?.secondsLeft;
            if (secondsLeft) {
                setTimer(secondsLeft);
                setCanResend(false);
            }
        }
        inputRefs.current[0]?.focus();
    };

    const purposeLabels = {
        register:         'Verify Your Email',
        login:            'Verify Your Login',
        'forgot-password': 'Reset Your Password',
    };
    const heading = purposeLabels[purpose] || 'Verify Your Email';

    const isActive = submitting || isLoading;
    const allFilled = otp.every(d => d !== '');

    return (
        <div className="otp-verification-overlay" role="dialog" aria-modal="true" aria-label={heading}>
            <motion.div
                initial={{ opacity: 0, scale: 0.93, y: 16 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                transition={{ duration: 0.28, ease: [0.25, 0.46, 0.45, 0.94] }}
            >
                <GlassCard className="otp-verification-card">
                    <button
                        className="otp-back-btn"
                        onClick={onCancel}
                        aria-label="Go back"
                        disabled={isActive}
                    >
                        <ArrowLeft size={20} />
                    </button>

                    <div className="otp-header">
                        <div className="otp-icon-wrapper">
                            <ShieldCheck size={32} className="otp-icon" />
                        </div>
                        <h2>{heading}</h2>
                        <p>
                            We sent a 6-digit code to{' '}
                            <strong className="otp-email">{email}</strong>
                        </p>
                    </div>

                    <form onSubmit={handleSubmit} className="otp-form" noValidate>
                        <div className="otp-inputs" role="group" aria-label="Enter verification code">
                            {otp.map((digit, index) => (
                                <input
                                    key={index}
                                    ref={(el) => (inputRefs.current[index] = el)}
                                    id={`otp-input-${index}`}
                                    type="tel"
                                    inputMode="numeric"
                                    pattern="[0-9]*"
                                    maxLength={1}
                                    value={digit}
                                    onChange={(e) => handleChange(index, e.target.value)}
                                    onKeyDown={(e) => handleKeyDown(index, e)}
                                    onPaste={handlePaste}
                                    className={`otp-input${digit ? ' filled' : ''}`}
                                    disabled={isActive}
                                    aria-label={`Digit ${index + 1}`}
                                    // SMS / OS autofill — only on first input
                                    {...(index === 0 ? { autoComplete: 'one-time-code' } : { autoComplete: 'off' })}
                                />
                            ))}
                        </div>

                        {attemptsRemaining !== null && (
                            <motion.div
                                className="otp-attempts-warning"
                                initial={{ opacity: 0, y: -6 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ duration: 0.2 }}
                                role="alert"
                            >
                                <AlertTriangle size={14} />
                                <span>
                                    {attemptsRemaining === 0
                                        ? 'Account locked. Please wait 15 minutes.'
                                        : `${attemptsRemaining} attempt${attemptsRemaining !== 1 ? 's' : ''} remaining before lockout`
                                    }
                                </span>
                            </motion.div>
                        )}

                        <Button
                            type="submit"
                            variant="primary"
                            className="otp-submit-btn"
                            loading={isActive}
                            disabled={!allFilled || isActive}
                        >
                            {isActive ? 'Verifying…' : 'Verify Code'}
                        </Button>
                    </form>

                    <div className="otp-footer">
                        <p>Didn't receive the code?</p>
                        <button
                            type="button"
                            className={`resend-btn${!canResend ? ' disabled' : ''}`}
                            onClick={handleResend}
                            disabled={!canResend || isActive}
                            aria-label={canResend ? 'Resend OTP' : `Resend available in ${timer} seconds`}
                        >
                            {canResend ? (
                                <>
                                    <RefreshCw size={14} />
                                    Resend Code
                                </>
                            ) : (
                                <span className="resend-timer">
                                    Resend in <strong>{timer}s</strong>
                                </span>
                            )}
                        </button>
                    </div>
                </GlassCard>
            </motion.div>
        </div>
    );
};

export default OTPVerification;
