import { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle, AlertTriangle, XCircle, Info, X } from 'lucide-react';
import './Toast.css';

const icons = {
    success: <CheckCircle size={18} />,
    error: <XCircle size={18} />,
    warning: <AlertTriangle size={18} />,
    info: <Info size={18} />,
};

function ToastItem({ toast, onRemove }) {
    useEffect(() => {
        const timer = setTimeout(() => onRemove(toast.id), toast.duration);
        return () => clearTimeout(timer);
    }, [toast, onRemove]);

    return (
        <motion.div
            layout
            className={`toast-item toast-${toast.type}`}
            initial={{ opacity: 0, x: 80, scale: 0.9 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, x: 80, scale: 0.9 }}
            transition={{ type: 'spring', damping: 20, stiffness: 300 }}
        >
            <span className="toast-icon">{icons[toast.type]}</span>
            <span className="toast-message">{toast.message}</span>
            <button className="toast-close" onClick={() => onRemove(toast.id)}>
                <X size={14} />
            </button>
            <motion.div
                className="toast-progress"
                initial={{ width: '100%' }}
                animate={{ width: '0%' }}
                transition={{ duration: toast.duration / 1000, ease: 'linear' }}
            />
        </motion.div>
    );
}

export default function Toast({ toasts, onRemove }) {
    return (
        <div className="toast-container">
            <AnimatePresence>
                {toasts.map(toast => (
                    <ToastItem key={toast.id} toast={toast} onRemove={onRemove} />
                ))}
            </AnimatePresence>
        </div>
    );
}
