import { GoogleLogin } from '@react-oauth/google';
import { motion } from 'framer-motion';

export default function GoogleSignInButton({ onSuccess, onError, loading, label }) {
    // Map custom label to Google Identity Services text option
    let textProp = 'signin_with';
    if (label === 'signup' || label === 'signup_with') {
        textProp = 'signup_with';
    } else if (label === 'continue' || label === 'continue_with') {
        textProp = 'continue_with';
    }

    return (
        <motion.div
            className="google-signin-btn-wrapper"
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            style={{
                width: '100%',
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                minHeight: '44px',
                borderRadius: '8px',
                overflow: 'hidden'
            }}
        >
            {loading ? (
                <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    color: 'var(--text-secondary, #94a3b8)',
                    fontSize: '0.9rem',
                    fontWeight: 500
                }}>
                    <div style={{
                        width: '18px',
                        height: '18px',
                        border: '2px solid rgba(139, 92, 246, 0.2)',
                        borderTopColor: '#8b5cf6',
                        borderRadius: '50%',
                        animation: 'spin 0.8s linear infinite',
                    }} />
                    <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
                    <span>Connecting securely...</span>
                </div>
            ) : (
                <div style={{ width: '100%', display: 'flex', justifyContent: 'center' }}>
                    <GoogleLogin
                        onSuccess={onSuccess}
                        onError={onError}
                        theme="filled_blue"
                        size="large"
                        text={textProp}
                        shape="pill"
                        logo_alignment="left"
                        width="320px" // Premium and compact sizing that stays responsive
                    />
                </div>
            )}
        </motion.div>
    );
}
