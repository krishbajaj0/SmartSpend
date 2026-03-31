import React, { useState, useEffect, useRef } from 'react';
import './OTPVerification.css';
import GlassCard from '../ui/GlassCard';
import Button from '../ui/Button';
import { ShieldCheck, RefreshCw, ArrowLeft } from 'lucide-react';
import { useToast } from '../../context/ToastContext';

const OTPVerification = ({ email, onVerify, onResend, onCancel, isLoading }) => {
    const { error } = useToast();
    const [otp, setOtp] = useState(['', '', '', '', '', '']);
    const [timer, setTimer] = useState(60);
    const [canResend, setCanResend] = useState(false);
    const inputRefs = useRef([]);

    useEffect(() => {
        let interval;
        if (timer > 0) {
            interval = setInterval(() => {
                setTimer((prev) => prev - 1);
            }, 1000);
        } else {
            setCanResend(true);
            clearInterval(interval);
        }
        return () => clearInterval(interval);
    }, [timer]);

    const handleChange = (index, value) => {
        if (isNaN(value)) return;
        const newOtp = [...otp];
        newOtp[index] = value.substring(value.length - 1);
        setOtp(newOtp);

        // Move to next input if value is entered
        if (value && index < 5) {
            inputRefs.current[index + 1].focus();
        }
    };

    const handleKeyDown = (index, e) => {
        if (e.key === 'Backspace' && !otp[index] && index > 0) {
            inputRefs.current[index - 1].focus();
        }
    };

    const handlePaste = (e) => {
        e.preventDefault();
        const data = e.clipboardData.getData('text').slice(0, 6);
        if (!/^\d+$/.test(data)) return;
        
        const newOtp = [...otp];
        data.split('').forEach((char, i) => {
            if (i < 6) newOtp[i] = char;
        });
        setOtp(newOtp);
        
        const nextIndex = data.length < 6 ? data.length : 5;
        inputRefs.current[nextIndex].focus();
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        const otpValue = otp.join('');
        if (otpValue.length !== 6) {
            error('Please enter a 6-digit code');
            return;
        }
        onVerify(otpValue);
    };

    const handleResend = () => {
        if (!canResend) return;
        setOtp(['', '', '', '', '', '']);
        setTimer(60);
        setCanResend(false);
        onResend();
        inputRefs.current[0].focus();
    };

    return (
        <div className="otp-verification-overlay">
            <GlassCard className="otp-verification-card">
                <button className="otp-back-btn" onClick={onCancel}>
                    <ArrowLeft size={20} />
                </button>
                
                <div className="otp-header">
                    <div className="otp-icon-wrapper">
                        <ShieldCheck size={32} className="otp-icon" />
                    </div>
                    <h2>Verify Your Email</h2>
                    <p>We've sent a 6-digit code to <strong>{email}</strong></p>
                </div>

                <form onSubmit={handleSubmit} className="otp-form">
                    <div className="otp-inputs">
                        {otp.map((digit, index) => (
                            <input
                                key={index}
                                ref={(el) => (inputRefs.current[index] = el)}
                                type="text"
                                maxLength={1}
                                value={digit}
                                onChange={(e) => handleChange(index, e.target.value)}
                                onKeyDown={(e) => handleKeyDown(index, e)}
                                onPaste={handlePaste}
                                className="otp-input"
                                disabled={isLoading}
                                autoFocus={index === 0}
                            />
                        ))}
                    </div>

                    <Button 
                        type="submit" 
                        variant="primary" 
                        className="otp-submit-btn"
                        isLoading={isLoading}
                        disabled={otp.some(d => d === '')}
                    >
                        Verify Code
                    </Button>
                </form>

                <div className="otp-footer">
                    <p>Didn't receive the code?</p>
                    <button 
                        type="button" 
                        className={`resend-btn ${!canResend ? 'disabled' : ''}`}
                        onClick={handleResend}
                        disabled={!canResend || isLoading}
                    >
                        {canResend ? (
                            <><RefreshCw size={16} /> Resend OTP</>
                        ) : (
                            `Resend in ${timer}s`
                        )}
                    </button>
                </div>
            </GlassCard>
        </div>
    );
};

export default OTPVerification;
