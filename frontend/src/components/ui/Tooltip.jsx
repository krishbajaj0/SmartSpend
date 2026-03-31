import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import './Tooltip.css';

export default function Tooltip({ children, content, position = 'top', className = '' }) {
    const [show, setShow] = useState(false);

    return (
        <div
            className={`tooltip-wrapper ${className}`}
            onMouseEnter={() => setShow(true)}
            onMouseLeave={() => setShow(false)}
        >
            {children}
            <AnimatePresence>
                {show && (
                    <motion.div
                        className={`tooltip tooltip-${position}`}
                        initial={{ opacity: 0, y: position === 'top' ? 4 : -4 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: position === 'top' ? 4 : -4 }}
                        transition={{ duration: 0.15 }}
                    >
                        {content}
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
