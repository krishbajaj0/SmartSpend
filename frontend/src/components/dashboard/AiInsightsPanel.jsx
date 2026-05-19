import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Brain, TrendingUp, TrendingDown, AlertTriangle, Lightbulb, ChevronRight, Sparkles } from 'lucide-react';
import GlassCard from '../ui/GlassCard';
import { aiAPI } from '../../utils/api';
import './AiInsightsPanel.css';

const INSIGHT_ICONS = {
    spending_spike: TrendingUp,
    spending_drop: TrendingDown,
    anomaly: AlertTriangle,
    trend: TrendingUp,
    tip: Lightbulb,
    default: Sparkles,
};

const INSIGHT_COLORS = {
    spending_spike: '#ef4444',
    spending_drop: '#10b981',
    anomaly: '#f59e0b',
    trend: '#6366f1',
    tip: '#8b5cf6',
    default: '#14b8a6',
};

export default function AiInsightsPanel() {
    const [insights, setInsights] = useState([]);
    const [loading, setLoading] = useState(true);
    const [expanded, setExpanded] = useState(false);

    useEffect(() => {
        let cancelled = false;
        async function load() {
            try {
                const res = await aiAPI.getInsights();
                if (!cancelled) {
                    setInsights(res.data.insights || []);
                }
            } catch {
                // silent — non-critical
            }
            if (!cancelled) setLoading(false);
        }
        load();
        return () => { cancelled = true; };
    }, []);

    if (loading) {
        return (
            <GlassCard className="ai-insights-panel">
                <div className="ai-insights-header">
                    <Brain size={18} className="ai-insights-icon pulse" />
                    <span>AI Insights</span>
                </div>
                <div className="ai-insights-skeleton">
                    <div className="skeleton-line" />
                    <div className="skeleton-line short" />
                </div>
            </GlassCard>
        );
    }

    if (insights.length === 0) {
        return (
            <GlassCard className="ai-insights-panel">
                <div className="ai-insights-header">
                    <Brain size={18} className="ai-insights-icon" />
                    <span>AI Insights</span>
                </div>
                <div className="ai-insights-empty-container" style={{ padding: '24px 12px', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px' }}>
                    <span style={{ fontSize: '20px', opacity: 0.85 }}>🧠</span>
                    <p className="ai-insights-empty" style={{ margin: 0, fontSize: '0.85rem', fontWeight: '500', color: 'var(--text-secondary)' }}>
                        AI insights will activate shortly
                    </p>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)', maxWidth: '240px', lineHeight: '1.4' }}>
                        Log at least 5 transactions to allow SmartSpend AI to identify trends and detect spikes.
                    </span>
                </div>
            </GlassCard>
        );
    }

    const visibleInsights = expanded ? insights : insights.slice(0, 3);

    return (
        <GlassCard className="ai-insights-panel">
            <div className="ai-insights-header">
                <Brain size={18} className="ai-insights-icon" />
                <span>AI Insights</span>
                <span className="ai-insights-badge">{insights.length}</span>
            </div>
            <AnimatePresence mode="popLayout">
                {visibleInsights.map((insight, i) => {
                    const type = insight.type || 'default';
                    const Icon = INSIGHT_ICONS[type] || INSIGHT_ICONS.default;
                    const color = INSIGHT_COLORS[type] || INSIGHT_COLORS.default;
                    return (
                        <motion.div
                            key={insight.id || i}
                            className={`ai-insight-item ${i === 0 ? 'primary' : 'secondary'}`}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -10 }}
                            transition={{ delay: i * 0.06 }}
                        >
                            <div className="ai-insight-icon" style={{ background: `${color}18`, color }}>
                                <Icon size={14} />
                            </div>
                            <div className="ai-insight-content">
                                <span className="ai-insight-message">{insight.message}</span>
                                {insight.detail && (
                                    <span className="ai-insight-detail">{insight.detail}</span>
                                )}
                            </div>
                        </motion.div>
                    );
                })}
            </AnimatePresence>
            {insights.length > 3 && (
                <button className="ai-insights-toggle" onClick={() => setExpanded(!expanded)}>
                    {expanded ? 'Show less' : `Show ${insights.length - 3} more`}
                    <ChevronRight size={14} className={expanded ? 'rotated' : ''} />
                </button>
            )}
        </GlassCard>
    );
}
