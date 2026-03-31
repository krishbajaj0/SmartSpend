import { motion, AnimatePresence } from 'framer-motion';
import { AlertTriangle } from 'lucide-react';
import Button from './Button';
import './ConfirmDialog.css';

export default function ConfirmDialog({
    isOpen,
    onClose,
    onConfirm,
    title = 'Are you sure?',
    message = 'This action cannot be undone.',
    confirmLabel = 'Delete',
    cancelLabel = 'Cancel',
    loading = false,
}) {
    return (
        <AnimatePresence>
            {isOpen && (
                <div className="confirm-overlay-wrapper">
                    <motion.div
                        className="confirm-backdrop"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={onClose}
                    />
                    <motion.div
                        className="confirm-dialog"
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.9 }}
                        transition={{ type: 'spring', damping: 25, stiffness: 300 }}
                    >
                        <motion.div
                            className="confirm-icon"
                            initial={{ scale: 0 }}
                            animate={{ scale: 1, rotate: [0, -10, 10, -10, 0] }}
                            transition={{ delay: 0.15, duration: 0.5 }}
                        >
                            <AlertTriangle size={32} />
                        </motion.div>
                        <h3 className="confirm-title">{title}</h3>
                        <p className="confirm-message">{message}</p>
                        <div className="confirm-actions">
                            <Button variant="ghost" onClick={onClose} disabled={loading}>
                                {cancelLabel}
                            </Button>
                            <Button variant="danger" onClick={onConfirm} loading={loading}>
                                {confirmLabel}
                            </Button>
                        </div>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    );
}
