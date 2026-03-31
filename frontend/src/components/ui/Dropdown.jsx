import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown } from 'lucide-react';
import './Dropdown.css';

export default function Dropdown({
    options = [],
    value,
    onChange,
    placeholder = 'Select...',
    label,
    className = '',
}) {
    const [isOpen, setIsOpen] = useState(false);
    const ref = useRef(null);

    const selected = options.find(o => o.value === value);

    useEffect(() => {
        const handleClick = (e) => {
            if (ref.current && !ref.current.contains(e.target)) setIsOpen(false);
        };
        document.addEventListener('mousedown', handleClick);
        return () => document.removeEventListener('mousedown', handleClick);
    }, []);

    return (
        <div className={`dropdown ${className}`} ref={ref}>
            {label && <span className="dropdown-label">{label}</span>}
            <button
                className={`dropdown-trigger ${isOpen ? 'open' : ''}`}
                onClick={() => setIsOpen(!isOpen)}
                type="button"
            >
                <span className={selected ? 'dropdown-value' : 'dropdown-placeholder'}>
                    {selected ? selected.label : placeholder}
                </span>
                <motion.span
                    className="dropdown-chevron"
                    animate={{ rotate: isOpen ? 180 : 0 }}
                    transition={{ duration: 0.2 }}
                >
                    <ChevronDown size={16} />
                </motion.span>
            </button>
            <AnimatePresence>
                {isOpen && (
                    <motion.ul
                        className="dropdown-menu"
                        initial={{ opacity: 0, scaleY: 0 }}
                        animate={{ opacity: 1, scaleY: 1 }}
                        exit={{ opacity: 0, scaleY: 0 }}
                        transition={{ duration: 0.2, ease: 'easeOut' }}
                    >
                        {options.map((opt, i) => (
                            <motion.li
                                key={opt.value}
                                className={`dropdown-item ${value === opt.value ? 'active' : ''}`}
                                initial={{ opacity: 0, y: -5 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: i * 0.03 }}
                                onClick={() => {
                                    onChange(opt.value);
                                    setIsOpen(false);
                                }}
                            >
                                {opt.icon && <span className="dropdown-item-icon">{opt.icon}</span>}
                                {opt.label}
                            </motion.li>
                        ))}
                    </motion.ul>
                )}
            </AnimatePresence>
        </div>
    );
}
