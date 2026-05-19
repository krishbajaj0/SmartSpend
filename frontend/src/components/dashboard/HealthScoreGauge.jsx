import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Heart, ChevronDown, ChevronUp, Lightbulb } from 'lucide-react';
import GlassCard from '../ui/GlassCard';
import { aiAPI } from '../../utils/api';
import './HealthScoreGauge.css';

const GRADE_COLORS = {
    'A+': '#10b981', 'A': '#10b981',
    'B+': '#22c55e', 'B': '#84cc16',
    'C+': '#eab308', 'C': '#f59e0b',
    'D': '#ef4444', 'F': '#dc2626',
};

function ScoreRing({ score, grade, size = 120 }) {
    const strokeWidth = 8;
    const radius = (size - strokeWidth) / 2;
    const circumference = 2 * Math.PI * radius;
    const progress = (score / 100) * circumference;
    const color = GRADE_COLORS[grade] || '#8b5cf6';

    return (
        <div className="health-score-ring" style={{ width: size, height: size }}>
            <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
                {/* Background ring */}
                <circle
                    cx={size / 2} cy={size / 2} r={radius}
                    fill="none" stroke="rgba(255,255,255,0.06)"
                    strokeWidth={strokeWidth}
                />
                {/* Progress ring */}
                <motion.circle
                    cx={size / 2} cy={size / 2} r={radius}
                    fill="none" stroke={color}
                    strokeWidth={strokeWidth}
                    strokeLinecap="round"
                    strokeDasharray={circumference}
                    initial={{ strokeDashoffset: circumference }}
                    animate={{ strokeDashoffset: circumference - progress }}
                    transition={{ duration: 1.5, ease: [0.25, 0.46, 0.45, 0.94], delay: 0.3 }}
                    style={{ transform: 'rotate(-90deg)', transformOrigin: 'center' }}
                />
            </svg>
            <div className="health-score-center">
                <motion.span
                    className="health-score-number"
                    initial={{ opacity: 0, scale: 0.5 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ duration: 0.6, delay: 0.8 }}
                    style={{ color }}
                >
                    {score}
                </motion.span>
                <motion.span
                    className="health-score-grade"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 1.2 }}
                >
                    {grade}
                </motion.span>
            </div>
        </div>
    );
}

function FactorBar({ factor, delay = 0 }) {
    const barColor = factor.score >= 70 ? '#10b981' : factor.score >= 40 ? '#eab308' : '#ef4444';
    return (
        <div className="health-factor">
            <div className="health-factor-header">
                <span className="health-factor-name">{factor.factor}</span>
                <span className="health-factor-score" style={{ color: barColor }}>
                    {factor.score}/100
                </span>
            </div>
            <div className="health-factor-bar-bg">
                <motion.div
                    className="health-factor-bar"
                    style={{ background: barColor }}
                    initial={{ width: 0 }}
                    animate={{ width: `${factor.score}%` }}
                    transition={{ duration: 0.8, delay: delay * 0.1 + 0.5, ease: 'easeOut' }}
                />
            </div>
            <span className="health-factor-detail">{factor.detail}</span>
        </div>
    );
}

export default function HealthScoreGauge() {
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [showBreakdown, setShowBreakdown] = useState(false);

    useEffect(() => {
        let cancelled = false;
        async function load() {
            try {
                const res = await aiAPI.getHealthScore();
                if (!cancelled) setData(res.data);
            } catch {
                // silent — non-critical feature
            }
            if (!cancelled) setLoading(false);
        }
        load();
        return () => { cancelled = true; };
    }, []);

    if (loading) {
        return (
            <GlassCard className="health-score-card">
                <div className="health-score-header">
                    <Heart size={18} className="health-icon pulse" />
                    <span>Financial Health</span>
                </div>
                <div className="health-score-loading">
                    <div className="skeleton-circle" />
                </div>
            </GlassCard>
        );
    }

    if (!data) return null;

    return (
        <GlassCard className="health-score-card">
            <div className="health-score-header">
                <Heart size={18} className="health-icon" />
                <span>Financial Health Score</span>
            </div>

            <div className="health-score-main">
                <ScoreRing score={data.score} grade={data.grade} />
                <div className="health-score-summary">
                    <span className="health-score-label">
                        {data.score >= 80 ? 'Excellent!' : data.score >= 60 ? 'Good' : data.score >= 40 ? 'Needs Work' : 'Critical'}
                    </span>
                    {data.tips?.[0] && (
                        <div className="health-tip">
                            <Lightbulb size={12} />
                            <span>{data.tips[0].message}</span>
                        </div>
                    )}
                </div>
            </div>

            <button
                className="health-breakdown-toggle"
                onClick={() => setShowBreakdown(!showBreakdown)}
            >
                {showBreakdown ? 'Hide' : 'Show'} Breakdown
                {showBreakdown ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            </button>

            {showBreakdown && (
                <motion.div
                    className="health-breakdown"
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    transition={{ duration: 0.3 }}
                >
                    {data.breakdown?.map((factor, i) => (
                        <FactorBar key={factor.factor} factor={factor} delay={i} />
                    ))}

                    {data.tips?.length > 1 && (
                        <div className="health-tips-section">
                            <span className="health-tips-title">💡 Improvement Tips</span>
                            {data.tips.slice(1).map((tip, i) => (
                                <div key={i} className="health-tip-item">
                                    <span className={`tip-priority ${tip.priority}`} />
                                    <span>{tip.message}</span>
                                </div>
                            ))}
                        </div>
                    )}
                </motion.div>
            )}
        </GlassCard>
    );
}
