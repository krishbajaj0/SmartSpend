import { useEffect, useState } from 'react';
import './ProgressRing.css';

export default function ProgressRing({
    value = 0,
    max = 100,
    size = 120,
    strokeWidth = 8,
    color,
    label,
    milestones = [],
    className = '',
}) {
    const [animated, setAnimated] = useState(false);
    const pct = Math.min((value / max) * 100, 100);
    const radius = (size - strokeWidth) / 2;
    const circumference = 2 * Math.PI * radius;
    const offset = circumference - (pct / 100) * circumference;

    // Determine color based on percentage
    const fillColor = color || (pct < 60 ? 'var(--success)' : pct < 85 ? 'var(--warning)' : 'var(--danger)');

    useEffect(() => {
        const timer = setTimeout(() => setAnimated(true), 100);
        return () => clearTimeout(timer);
    }, []);

    // Calculate milestone positions on the ring
    function getMilestonePos(percentage) {
        const angle = (percentage / 100) * 360 - 90; // -90 for top start
        const rad = (angle * Math.PI) / 180;
        const cx = size / 2 + radius * Math.cos(rad);
        const cy = size / 2 + radius * Math.sin(rad);
        return { left: cx, top: cy };
    }

    const fontSize = size <= 80 ? '1rem' : size <= 120 ? '1.375rem' : '1.75rem';

    return (
        <div className={`progress-ring-container ${className}`} style={{ width: size, height: size }}>
            <svg className="progress-ring-svg" width={size} height={size}>
                <circle
                    className="progress-ring-track"
                    cx={size / 2}
                    cy={size / 2}
                    r={radius}
                    strokeWidth={strokeWidth}
                />
                <circle
                    className="progress-ring-fill"
                    cx={size / 2}
                    cy={size / 2}
                    r={radius}
                    strokeWidth={strokeWidth}
                    stroke={fillColor}
                    strokeDasharray={circumference}
                    strokeDashoffset={animated ? offset : circumference}
                />
            </svg>
            <div className="progress-ring-center">
                <span className="progress-ring-value" style={{ fontSize }}>
                    {Math.round(pct)}%
                </span>
                {label && <span className="progress-ring-label">{label}</span>}
            </div>
            {milestones.map(m => {
                const pos = getMilestonePos(m.percentage);
                return (
                    <div
                        key={m.percentage}
                        className={`progress-ring-milestone ${m.reached ? 'reached' : 'pending'}`}
                        style={{ left: pos.left, top: pos.top }}
                        title={`${m.percentage}%`}
                    />
                );
            })}
        </div>
    );
}
