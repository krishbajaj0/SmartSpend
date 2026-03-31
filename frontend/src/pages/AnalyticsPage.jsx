import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip,
    ResponsiveContainer, LineChart, Line, Legend,
} from 'recharts';
import { FileText, FileSpreadsheet } from 'lucide-react';
import { format } from 'date-fns';
import GlassCard from '../components/ui/GlassCard';
import Button from '../components/ui/Button';
import EmptyState from '../components/ui/EmptyState';
import ScrollReveal from '../components/ScrollReveal';
import SpendingHeatmap from '../components/analytics/SpendingHeatmap';
import { CATEGORIES } from '../components/ui/CategoryBadge';
import { useToast } from '../context/ToastContext';
import { analyticsAPI, expensesAPI } from '../utils/api';
import './AnalyticsPage.css';

const CHART_COLORS = ['#6c5ce7', '#00cec9', '#fdcb6e', '#e17055', '#00b894', '#a29bfe', '#fab1a0'];

function ChartTooltip({ active, payload, label }) {
    if (!active || !payload?.length) return null;
    return (
        <div className="chart-tooltip glass" style={{ padding: '8px 12px', borderRadius: 'var(--radius-md)' }}>
            <p style={{ fontWeight: 600, marginBottom: 4 }}>{label}</p>
            {payload.map((p, i) => (
                <p key={i} style={{ color: p.color, fontSize: '0.85rem' }}>
                    {p.name}: ₹{p.value?.toLocaleString('en-IN')}
                </p>
            ))}
        </div>
    );
}

export default function AnalyticsPage() {
    const { addToast } = useToast();
    const navigate = useNavigate();
    const [loading, setLoading] = useState(true);
    const [comparisonData, setComparisonData] = useState([]);
    const [categoryTrendData, setCategoryTrendData] = useState([]);
    const [topMerchants, setTopMerchants] = useState([]);
    const [allExpenses, setAllExpenses] = useState([]);

    useEffect(() => {
        async function loadAnalytics() {
            setLoading(true);
            try {
                const [compRes, topRes, catTimeRes, expRes] = await Promise.allSettled([
                    analyticsAPI.getComparison(),
                    analyticsAPI.getTopMerchants(),
                    analyticsAPI.getCategoryOverTime(),
                    expensesAPI.list({ limit: 200, sortBy: 'date', sortOrder: 'desc' }),
                ]);

                // Comparison
                if (compRes.status === 'fulfilled') {
                    const comp = compRes.value.data.comparison || [];
                    setComparisonData(comp.map(c => ({
                        name: (CATEGORIES[c.category]?.icon || '') + ' ' + (CATEGORIES[c.category]?.label || c.category),
                        thisMonth: Math.round(c.thisMonth || 0),
                        lastMonth: Math.round(c.lastMonth || 0),
                    })).filter(c => c.thisMonth > 0 || c.lastMonth > 0));
                }

                // Top merchants
                if (topRes.status === 'fulfilled') {
                    setTopMerchants((topRes.value.data.merchants || []).slice(0, 8));
                }

                // Category over time
                if (catTimeRes.status === 'fulfilled') {
                    setCategoryTrendData(catTimeRes.value.data.data || []);
                }

                // All expenses for heatmap + export
                if (expRes.status === 'fulfilled') {
                    setAllExpenses(expRes.value.data.expenses || []);
                }
            } catch { /* silent */ }
            setLoading(false);
        }
        loadAnalytics();
    }, []);

    const maxMerchantSpend = topMerchants[0]?.total || topMerchants[0]?.amount || 1;

    function exportData(type) {
        if (allExpenses.length === 0) {
            addToast('No data to export', { type: 'info' });
            return;
        }
        if (type === 'csv') {
            const rows = [['Date', 'Merchant', 'Category', 'Amount']];
            allExpenses.forEach(e => {
                rows.push([e.date ? format(new Date(e.date), 'yyyy-MM-dd') : '', e.merchant || '', e.category || '', e.amount || 0]);
            });
            const csv = rows.map(r => r.join(',')).join('\n');
            const blob = new Blob([csv], { type: 'text/csv' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `expenses-${format(new Date(), 'yyyy-MM-dd')}.csv`;
            a.click();
            URL.revokeObjectURL(url);
            addToast('CSV exported!', { type: 'success' });
        } else {
            addToast('PDF export coming soon.', { type: 'info' });
        }
    }

    const trendColors = {
        food: CHART_COLORS[0],
        transport: CHART_COLORS[1],
        shopping: CHART_COLORS[3],
        bills: CHART_COLORS[2],
        entertainment: CHART_COLORS[4],
    };

    if (loading) {
        return (
            <div className="analytics-page" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '40vh' }}>
                <div className="loading-spinner" />
            </div>
        );
    }

    const isEmpty = allExpenses.length === 0;

    if (isEmpty) {
        return (
            <div className="analytics-page">
                <div className="analytics-page-header"><h1>Analytics & Reports</h1></div>
                <EmptyState
                    title="No analytics data yet"
                    description="Add some expenses to see your spending analytics and trends."
                    actionLabel="Add Expenses"
                    onAction={() => navigate('/expenses')}
                />
            </div>
        );
    }

    return (
        <div className="analytics-page">
            <div className="analytics-page-header">
                <h1>Analytics & Reports</h1>
                <div className="export-buttons">
                    <Button variant="secondary" size="sm" icon={<FileSpreadsheet size={14} />} onClick={() => exportData('csv')}>
                        Export CSV
                    </Button>
                    <Button variant="ghost" size="sm" icon={<FileText size={14} />} onClick={() => exportData('pdf')}>
                        Export PDF
                    </Button>
                </div>
            </div>

            <div className="analytics-grid">
                {/* Monthly Comparison */}
                {comparisonData.length > 0 && (
                    <ScrollReveal variant="fade-up" className="analytics-grid-full">
                        <GlassCard className="analytics-chart-card" hoverable={false}>
                            <div className="analytics-section-header"><h3>📊 Monthly Comparison</h3></div>
                            <ResponsiveContainer width="100%" height={300}>
                                <BarChart data={comparisonData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                                    <XAxis dataKey="name" stroke="var(--text-tertiary)" fontSize={11} tickLine={false} />
                                    <YAxis stroke="var(--text-tertiary)" fontSize={11} tickLine={false} tickFormatter={v => `₹${(v / 1000).toFixed(0)}k`} />
                                    <RechartsTooltip content={<ChartTooltip />} />
                                    <Bar dataKey="lastMonth" name="Last Month" fill="#8892b0" radius={[4, 4, 0, 0]} animationDuration={1200} />
                                    <Bar dataKey="thisMonth" name="This Month" fill="#6c5ce7" radius={[4, 4, 0, 0]} animationDuration={1200} animationBegin={300} />
                                </BarChart>
                            </ResponsiveContainer>
                            <div className="comparison-legend">
                                <span className="comparison-legend-item">
                                    <span className="comparison-legend-dot" style={{ background: '#8892b0' }} /> Last Month
                                </span>
                                <span className="comparison-legend-item">
                                    <span className="comparison-legend-dot" style={{ background: '#6c5ce7' }} /> This Month
                                </span>
                            </div>
                        </GlassCard>
                    </ScrollReveal>
                )}

                {/* Spending Heatmap */}
                <ScrollReveal variant="fade-up" delay={0.1}>
                    <GlassCard className="analytics-chart-card" hoverable={false}>
                        <div className="analytics-section-header"><h3>🔥 Spending Heatmap</h3></div>
                        <SpendingHeatmap expenses={allExpenses} days={180} />
                    </GlassCard>
                </ScrollReveal>

                {/* Top Merchants */}
                {topMerchants.length > 0 && (
                    <ScrollReveal variant="fade-up" delay={0.15}>
                        <GlassCard className="analytics-chart-card" hoverable={false}>
                            <div className="analytics-section-header"><h3>🏪 Top Merchants</h3></div>
                            <div className="top-merchants-list">
                                {topMerchants.map((m, i) => {
                                    const total = m.total || m.amount || 0;
                                    const visits = m.visits || m.count || 0;
                                    return (
                                        <motion.div
                                            key={m.name || m.merchant}
                                            className="top-merchant-item"
                                            initial={{ opacity: 0, x: -20 }}
                                            animate={{ opacity: 1, x: 0 }}
                                            transition={{ delay: i * 0.05 }}
                                        >
                                            <span className="top-merchant-rank">{i + 1}</span>
                                            <div className="top-merchant-info">
                                                <div className="top-merchant-name">{m.name || m.merchant}</div>
                                                <div className="top-merchant-visits">{visits} visit{visits > 1 ? 's' : ''}</div>
                                            </div>
                                            <div className="top-merchant-bar-wrapper">
                                                <motion.div
                                                    className="top-merchant-bar"
                                                    initial={{ width: 0 }}
                                                    animate={{ width: `${(total / maxMerchantSpend) * 100}%` }}
                                                    transition={{ duration: 1, delay: i * 0.08, ease: 'easeOut' }}
                                                />
                                            </div>
                                            <span className="top-merchant-amount">₹{Math.round(total).toLocaleString('en-IN')}</span>
                                        </motion.div>
                                    );
                                })}
                            </div>
                        </GlassCard>
                    </ScrollReveal>
                )}

                {/* Category Trends */}
                {categoryTrendData.length > 0 && (
                    <ScrollReveal variant="fade-up" delay={0.1} className="analytics-grid-full">
                        <GlassCard className="analytics-chart-card" hoverable={false}>
                            <div className="analytics-section-header"><h3>📈 Category Trends (6 Months)</h3></div>
                            <ResponsiveContainer width="100%" height={300}>
                                <LineChart data={categoryTrendData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                                    <XAxis dataKey="month" stroke="var(--text-tertiary)" fontSize={11} tickLine={false} />
                                    <YAxis stroke="var(--text-tertiary)" fontSize={11} tickLine={false} tickFormatter={v => `₹${(v / 1000).toFixed(0)}k`} />
                                    <RechartsTooltip content={<ChartTooltip />} />
                                    {Object.entries(trendColors).map(([key, color]) => (
                                        <Line
                                            key={key}
                                            type="monotone"
                                            dataKey={key}
                                            name={CATEGORIES[key]?.label || key}
                                            stroke={color}
                                            strokeWidth={2}
                                            dot={false}
                                            activeDot={{ r: 5 }}
                                            animationDuration={1500}
                                        />
                                    ))}
                                    <Legend
                                        verticalAlign="bottom"
                                        height={36}
                                        formatter={(value) => <span style={{ color: 'var(--text-secondary)', fontSize: '0.8rem' }}>{value}</span>}
                                    />
                                </LineChart>
                            </ResponsiveContainer>
                        </GlassCard>
                    </ScrollReveal>
                )}
            </div>
        </div>
    );
}
