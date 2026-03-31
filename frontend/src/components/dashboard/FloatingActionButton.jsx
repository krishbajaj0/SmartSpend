import { motion } from 'framer-motion';
import { Plus } from 'lucide-react';
import './FloatingActionButton.css';

export default function FloatingActionButton({ onClick }) {
    return (
        <motion.button
            className="floating-add-btn"
            onClick={onClick}
            initial={{ scale: 0, rotate: 180 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ type: 'spring', stiffness: 260, damping: 20, delay: 1 }}
            whileHover={{ scale: 1.15 }}
            whileTap={{ scale: 0.9 }}
        >
            <div className="floating-btn-glow" />
            <div className="floating-btn-pulse" />
            <Plus size={24} />
        </motion.button>
    );
}
