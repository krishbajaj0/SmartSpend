import { motion } from 'framer-motion';
import { Inbox } from 'lucide-react';
import Button from './Button';
import './EmptyState.css';

export default function EmptyState({
    icon,
    title = 'Nothing here yet',
    description = 'Get started by adding your first item.',
    actionLabel,
    onAction,
    className = '',
}) {
    return (
        <motion.div
            className={`empty-state ${className}`}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
        >
            <motion.div
                className="empty-state-icon"
                animate={{ y: [0, -8, 0] }}
                transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
            >
                {icon || <Inbox size={56} />}
            </motion.div>
            <h3 className="empty-state-title">{title}</h3>
            <p className="empty-state-desc">{description}</p>
            {actionLabel && (
                <Button variant="primary" onClick={onAction}>
                    {actionLabel}
                </Button>
            )}
        </motion.div>
    );
}
