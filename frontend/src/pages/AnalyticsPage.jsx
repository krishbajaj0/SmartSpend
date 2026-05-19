import { useState, useEffect, useCallback } from 'react';
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
import { useAuth } from '../context/AuthContext';
import { analyticsAPI } from '../utils/api';
import { formatCurrency, formatCurrencyCompact } from '../utils/currency';
import { normalizeCategory } from '../utils/categoryNormalization';
import './AnalyticsPage.css';

const CHART_COLORS = ['#6c5ce7', '#00cec9', '#fdcb6e', '#e17055', '#00b894', '#a29bfe', '#fab1a0'];

function ChartTooltip({ active, payload, label }) {
    if (!active || !payload?.length) return null;
    return (
        <div className="chart-tooltip glass" style={{ padding: '8px 12px', borderRadius: 'var(--radius-md)' }}>
            <p style={{ fontWeight: 600, marginBottom: 4 }}>{label}</p>
            {payload.map((p, i) => (
                <p key={i} style={{ color: p.color, fontSize: '0.85rem' }}>
                    {p.name}: {formatCurrency(p.value)}
                </p>
            ))}
        </div>
    );
}

export default function AnalyticsPage() {
    const { addToast } = useToast();
    const { user } = useAuth();
    const currency = user?.currency || 'INR';
    const navigate = useNavigate();
    
    const [loading, setLoading] = useState(true);
    const [comparisonData, setComparisonData] = useState([]);
    const [categoryTrendData, setCategoryTrendData] = useState([]);
    const [topMerchants, setTopMerchants] = useState([]);
    const [heatmapData, setHeatmapData] = useState(null);

    const loadAnalytics = useCallback(async () => {
        setLoading(true);
        try {
            const [compRes, topRes, catTimeRes, heatmapRes] = await Promise.allSettled([
                analyticsAPI.getComparison(),
                analyticsAPI.getTopMerchants(),
                analyticsAPI.getCategoryOverTime(),
                analyticsAPI.getHeatmap(),
            ]);

            const results = [compRes, topRes, catTimeRes, heatmapRes];
            if (results.some(r => r.status === 'rejected' && r.reason?.response?.status === 503)) {
                addToast('System is busy. Showing partial data.', { type: 'error' });
            }

            if (compRes.status === 'fulfilled') {
                const comp = compRes.value.data.comparison || [];
                setComparisonData(comp.map(c => {
                    const norm = normalizeCategory(c.category);
                    return {
                        name: (CATEGORIES[norm]?.icon || '') + ' ' + (CATEGORIES[norm]?.label || c.category),
                        thisMonth: Math.round(c.thisMonth || 0),
                        lastMonth: Math.round(c.lastMonth || 0),
                    };
                })).filter(c => c.thisMonth > 0 || c.lastMonth > 0);
            }

            if (topRes.status === 'fulfilled') {
                setTopMerchants((topRes.value.data.merchants || []).slice(0, 8));
            }

            if (catTimeRes.status === 'fulfilled') {
                setCategoryTrendData(catTimeRes.value.data.data || []);
            }

            if (heatmapRes.status === 'fulfilled') {
                setHeatmapData(heatmapRes.value.data.heatmap || {});
            }
        } catch (err) {
            console.error("Analytics load failed:", err);
        }
        setLoading(false);
    }, [addToast, currency]);

    useEffect(() => {
        loadAnalytics();
    }, [loadAnalytics]);

    useEffect(() => {
        const handler = () => loadAnalytics();
        window.addEventListener('expenseUpdated', handler);
        return () => window.removeEventListener('expenseUpdated', handler);
    }, [loadAnalytics]);

    const maxMerchantSpend = topMerchants[0]?.total || topMerchants[0]?.amount || 1;

    async function exportData(type) {
        if (type === 'csv') {
            try {
                const res = await analyticsAPI.exportData({ format: 'csv' }, { responseType: 'blob' });
                const blob = new Blob([res.data], { type: 'text/csv' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `transactions-${format(new Date(), 'yyyy-MM-dd')}.csv`;
                a.click();
                URL.revokeObjectURL(url);
                addToast('CSV exported!', { type: 'success' });
            } catch (err) {
                console.error(err);
                addToast('Failed to export CSV', { type: 'error' });
            }
        } else if (type === 'pdf') {
            try {
                addToast('Preparing PDF report...', { type: 'info' });
                // Fetch all data in JSON format for the PDF
                const res = await analyticsAPI.exportData({ format: 'json' });
                const transactions = res.data.data || [];
                
                if (transactions.length === 0) {
                    addToast('No data to export', { type: 'warning' });
                    return;
                }

                const { jsPDF } = window.jspdf;
                const doc = new jsPDF();
                
                // Add header
                doc.setFontSize(20);
                doc.setTextColor(108, 92, 231); // var(--primary)
                doc.text('SmartSpend - Financial Report', 14, 22);
                
                doc.setFontSize(11);
                doc.setTextColor(100);
                doc.text(`Generated on: ${format(new Date(), 'PPP')}`, 14, 30);
                doc.text(`Total Transactions: ${transactions.length}`, 14, 36);

                // Prepare table data
                const tableColumn = ["Date", "Merchant", "Category", "Type", "Amount"];
                const tableRows = transactions.map(t => [
                    format(new Date(t.date), 'MMM d, yyyy'),
                    t.merchant || t.note || '-',
                    CATEGORIES[t.category]?.label || t.category,
                    t.type,
                    formatCurrency(t.amount, t.currency || currency)
                ]);

                // Generate table
                doc.autoTable({
                    head: [tableColumn],
                    body: tableRows,
                    startY: 45,
                    theme: 'grid',
                    headStyles: { fillStyle: 'fill', fillColor: [108, 92, 231] },
                    alternateRowStyles: { fillColor: [245, 245, 245] },
                });

                doc.save(`transactions-${format(new Date(), 'yyyy-MM-dd')}.pdf`);
                addToast('PDF exported!', { type: 'success' });
            } catch (err) {
                console.error("PDF Export Error:", err);
                addToast('Failed to generate PDF', { type: 'error' });
            }
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

    const isEmpty = comparisonData.length === 0 && topMerchants.length === 0 && (!heatmapData || Object.keys(heatmapData).length === 0);

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
                                    <YAxis stroke="var(--text-tertiary)" fontSize={11} tickLine={false} tickFormatter={v => formatCurrencyCompact(v, currency)} />
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
                        <SpendingHeatmap heatmapData={heatmapData} days={180} currency={currency} />
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
                                            key={m.name || m.merchant || i}
                                            className="top-merchant-item"
                                            initial={{ opacity: 0, x: -20 }}
                                            animate={{ opacity: 1, x: 0 }}
                                            transition={{ delay: i * 0.05 }}
                                        >
                                            <span className="top-merchant-rank">{i + 1}</span>
                                            <div className="top-merchant-info">
                                                <div className="top-merchant-name">{m.name || m.merchant || 'Miscellaneous'}</div>
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
                                            <span className="top-merchant-amount">{formatCurrency(Math.round(total), currency)}</span>
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
                                    <YAxis stroke="var(--text-tertiary)" fontSize={11} tickLine={false} tickFormatter={v => formatCurrencyCompact(v, currency)} />
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
