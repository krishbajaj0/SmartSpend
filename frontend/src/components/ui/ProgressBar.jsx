import { motion } from 'framer-motion';
import './ProgressBar.css';

function getColor(percentage) {
    if (percentage < 60) return 'var(--success)';
    if (percentage < 85) return 'var(--warning)';
    return 'var(--danger)';
}

export default function ProgressBar({
    value = 0,
    max = 100,
    label,
    showPercentage = true,
    animated = true,
    size = 'md',
    className = '',
    customColor,
}) {
    const pct = Math.min((value / max) * 100, 100);
    const color = customColor || getColor(pct);
    const isOver = value > max;

    return (
        <div className={`progress-bar-wrapper ${className}`}>
            {(label || showPercentage) && (
                <div className="progress-bar-header">
                    {label && <span className="progress-bar-label">{label}</span>}
                    {showPercentage && (
                        <span className="progress-bar-pct" style={{ color }}>
                            {Math.round(pct)}%
                        </span>
                    )}
                </div>
            )}
            <div className={`progress-bar-track progress-bar-${size}`}>
                <motion.div
                    className={`progress-bar-fill ${isOver ? 'progress-bar-over' : ''}`}
                    style={{ backgroundColor: color }}
                    initial={animated ? { width: 0 } : { width: `${pct}%` }}
                    animate={{ width: `${pct}%` }}
                    transition={{ duration: 1, ease: 'easeOut' }}
                />
            </div>
        </div>
    );
}
