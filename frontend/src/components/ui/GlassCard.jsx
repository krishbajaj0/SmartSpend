import { motion } from 'framer-motion';
import './GlassCard.css';

export default function GlassCard({
    children,
    className = '',
    hoverable = true,
    padding = true,
    onClick,
    ...props
}) {
    return (
        <motion.div
            className={`glass-card ${hoverable ? 'glass-card-hoverable' : ''} ${padding ? 'glass-card-padded' : ''} ${className}`}
            onClick={onClick}
            whileHover={hoverable ? { y: -4 } : undefined}
            transition={{ duration: 0.2 }}
            {...props}
        >
            {children}
        </motion.div>
    );
}
