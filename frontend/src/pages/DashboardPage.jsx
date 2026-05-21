import { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { format, subDays, eachDayOfInterval } from 'date-fns';
import { TrendingUp, Wallet, CreditCard, PiggyBank, Plus, Receipt, FileText } from 'lucide-react';
import EmptyState from '../components/ui/EmptyState';
import ScrollReveal, { ScrollRevealItem } from '../components/ScrollReveal';
import {
    StatCard, SpendingTrendChart, CategoryDonutChart,
    TransactionList, BudgetHealth,
    AccountsSummary,
    AiInsightsPanel,
    HealthScoreGauge,
} from '../components/dashboard';
import SmartSearch from '../components/dashboard/SmartSearch';
import { useAuth } from '../context/AuthContext';
import { dashboardAPI } from '../utils/api';
import { getCurrencySymbol } from '../utils/currency';
import { normalizeCategory } from '../utils/categoryNormalization';
import './DashboardPage.css';

const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
        opacity: 1,
        transition: { staggerChildren: 0.08 }
    }
};

const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.4, ease: [0.25, 0.46, 0.45, 0.94] } }
};

function QuickActions() {
    const navigate = useNavigate();
    const actions = [
        { icon: Plus, label: 'Add Transaction', color: '#8b5cf6', path: '/expenses?action=add' },
        { icon: Receipt, label: 'Scan Receipt', color: '#14b8a6', path: '/receipts' },
        { icon: FileText, label: 'Generate Report', color: '#6366f1', path: '/analytics' },
    ];

    return (
        <div className="quick-actions">
            {actions.map((a, i) => {
                const IconComponent = a.icon;
                return (
                    <motion.button
                        key={a.label}
                        className="quick-action-btn"
                        variants={itemVariants}
                        initial="hidden"
                        animate="visible"
                        transition={{ delay: 0.3 + i * 0.1 }}
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        onClick={() => navigate(a.path)}
                    >
                        <div className="quick-action-icon" style={{ background: `${a.color}20`, color: a.color }}>
                            <IconComponent size={18} />
                        </div>
                        <span>{a.label}</span>
                    </motion.button>
                );
            })}
        </div>
    );
}

/* ── Helpers ─────────────────────────────────────────────── */

function LoadingSkeleton() {
    return (
        <div className="dashboard-skeleton">
            <div className="skeleton-hero">
                <div className="skeleton-title" />
                <div className="skeleton-subtitle" />
            </div>
            <div className="skeleton-stats">
                {[1, 2, 3, 4].map(i => (
                    <div key={i} className="skeleton-stat" />
                ))}
            </div>
            <div className="skeleton-charts">
                <div className="skeleton-chart" />
                <div className="skeleton-chart" />
            </div>
        </div>
    );
}

/* ── Main Component ──────────────────────────────────────── */

export default function DashboardPage() {
    const { user, loading: authLoading } = useAuth();
    const currency = user?.currency || 'INR';
    const navigate = useNavigate();
    const [recentTransactions, setRecentTransactions] = useState([]);
    const [budgetList, setBudgetList] = useState([]);
    const [summary, setSummary] = useState({ totalSpent: 0, totalTransactions: 0, avgDaily: 0 });
    const [netWorth, setNetWorth] = useState(0);
    const [accountList, setAccountList] = useState([]);
    const [categoryData, setCategoryData] = useState([]);
    const [trendDays, setTrendDays] = useState(30);
    const [overallBudgetLimit, setOverallBudgetLimit] = useState(0);
    const [loading, setLoading] = useState(true);
    const [aiFilters, setAiFilters] = useState(null);
    const [degradedWarning, setDegradedWarning] = useState(false);
    const [totalExpenseCount, setTotalExpenseCount] = useState(null);

    /* ── Single API call — dashboard endpoint has everything ── */
    const loadDashboard = useCallback(async (opts = {}) => {
        setLoading(true);
        try {
            const { data } = await dashboardAPI.load(opts);

            // Surface degraded (stale cache) state to the user
            if (data.degraded) {
                setDegradedWarning(true);
            } else {
                setDegradedWarning(false);
            }

            const budgets = data.budgets || [];
            const overallBudget = budgets.find(b => b.category === 'overall');
            setOverallBudgetLimit(overallBudget?.limitAmount || overallBudget?.limit || 0);

            setRecentTransactions(data.recentTransactions || []);
            setBudgetList(budgets.map(b => ({
                ...b,
                spent: b.currentSpent || 0,
                limit: b.limitAmount || 0,
            })));
            setSummary(data.summary || { totalSpent: 0, totalTransactions: 0, avgDaily: 0 });
            setNetWorth(data.netWorth || 0);
            setAccountList(data.accounts || []);
            setCategoryData((data.categoryBreakdown || []).map(b => ({
                name: normalizeCategory(b.category),
                value: b.amount || 0,
            })));
            // Use total count (not just last-30-day count) to drive isEmpty
            setTotalExpenseCount(data.totalExpenseCount ?? data.recentTransactions?.length ?? 0);
        } catch (err) {
            console.error("Dashboard load failed:", err);
        }
        setLoading(false);
    }, []);

    useEffect(() => {
        if (!authLoading) loadDashboard();
    }, [authLoading, loadDashboard]);

    useEffect(() => {
        // Force cache bypass after any write so new data is always fresh
        const handler = () => loadDashboard({ noCache: true });
        window.addEventListener('expenseUpdated', handler);
        return () => window.removeEventListener('expenseUpdated', handler);
    }, [loadDashboard]);

    /* ── Derived data ─────────────────────────────────────── */

    const filteredTransactions = useMemo(() => {
        let filtered = recentTransactions;
        if (aiFilters) {
            if (aiFilters.category) {
                const searchCat = normalizeCategory(aiFilters.category);
                filtered = filtered.filter(e => normalizeCategory(e.category) === searchCat);
            }
            if (aiFilters.merchant) {
                const m = aiFilters.merchant.toLowerCase();
                filtered = filtered.filter(e => 
                    (e.merchant || '').toLowerCase().includes(m) || 
                    (e.note || '').toLowerCase().includes(m)
                );
            }
        }
        return filtered;
    }, [recentTransactions, aiFilters]);

    const trendData = useMemo(() => {
        const now = new Date();
        const from = subDays(now, trendDays);
        const dayMap = {};
        recentTransactions.forEach(e => {
            if (!e.date || e.type !== 'EXPENSE') return;
            const d = new Date(e.date);
            if (d >= from && d <= now) {
                const key = format(d, 'yyyy-MM-dd');
                dayMap[key] = (dayMap[key] || 0) + (e.amount || 0);
            }
        });
        return eachDayOfInterval({ start: from, end: now }).map(day => {
            const key = format(day, 'yyyy-MM-dd');
            return { date: key, label: format(day, 'MMM d'), amount: Math.round(dayMap[key] || 0) };
        });
    }, [recentTransactions, trendDays]);

    const categoryDataWithPercent = useMemo(() => {
        const total = categoryData.reduce((s, c) => s + c.value, 0);
        return categoryData.map(c => ({ ...c, percentage: total > 0 ? Math.round((c.value / total) * 100) : 0 }));
    }, [categoryData]);

    const sym = getCurrencySymbol(currency);
    const statCards = useMemo(() => [
        { label: 'Net Worth', value: netWorth, prefix: sym, icon: PiggyBank, color: '#10b981' },
        { label: 'Total Spent', value: summary.totalSpent || 0, prefix: sym, icon: TrendingUp, color: '#ef4444' },
        { label: 'Monthly Budget', value: overallBudgetLimit, prefix: sym, icon: Wallet, color: '#8b5cf6' },
        { label: 'Activity', value: summary.totalTransactions || 0, prefix: '', icon: CreditCard, color: '#14b8a6' },
    ], [summary, netWorth, overallBudgetLimit, sym]);

    // isEmpty = truly no expenses at all (not just no recent ones)
    const isEmpty = totalExpenseCount === 0 && !loading;

    /* ── Render ────────────────────────────────────────────── */

    if (authLoading || loading) return <LoadingSkeleton />;

    return (
        <motion.div className="dashboard-premium" variants={containerVariants} initial="hidden" animate="visible">
            <div className="dashboard-background">
                <div className="dashboard-bg-gradient" />
                <div className="dashboard-bg-grid" />
            </div>

            {degradedWarning && (
                <div style={{
                    background: 'rgba(234, 179, 8, 0.12)',
                    border: '1px solid rgba(234, 179, 8, 0.4)',
                    color: '#fef08a',
                    padding: '12px 16px',
                    borderRadius: '10px',
                    marginBottom: '20px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    fontSize: '0.9rem',
                }}>
                    <span style={{ fontSize: '1.2rem' }}>⚠️</span>
                    <span><strong>High Traffic:</strong> Showing cached data. Recent transactions may take a few minutes to appear.</span>
                    <button
                        onClick={() => setDegradedWarning(false)}
                        style={{ marginLeft: 'auto', background: 'none', border: 'none', color: '#fef08a', cursor: 'pointer', fontSize: '1.1rem' }}
                        aria-label="Dismiss"
                    >×</button>
                </div>
            )}

            {/* ── ZONE 1: KPI Overview ── */}
            <div className="dashboard-content-wrapper">
                <ScrollReveal stagger className="dashboard-stats-premium">
                {statCards.map((card, i) => (
                    <ScrollRevealItem key={card.label} variant="fade-up" delay={i * 0.1}>
                        <StatCard {...card} />
                    </ScrollRevealItem>
                ))}
            </ScrollReveal>

            <ScrollReveal variant="fade-up" delay={0.2}>
                <div className="dashboard-action-row-premium">
                    <div className="search-wrapper">
                        <SmartSearch
                            onFilter={(filters) => setAiFilters(filters)}
                            onClear={() => setAiFilters(null)}
                        />
                    </div>
                    <div className="actions-wrapper">
                        <QuickActions />
                    </div>
                </div>
            </ScrollReveal>

            {isEmpty ? (
                <ScrollReveal variant="fade-up">
                    <EmptyState
                        title="No expenses yet"
                        description="Add your first expense to see your financial overview come to life."
                        actionLabel="Add Transaction"
                        onAction={() => navigate('/expenses')}
                    />
                </ScrollReveal>
            ) : (
                <>
                    {/* ── ZONE 2: Primary Analytics ── */}
                    <div className="dashboard-charts-premium">
                        <ScrollReveal variant="fade-up" delay={0.3} className="chart-section-main">
                            <SpendingTrendChart
                                data={trendData}
                                trendDays={trendDays}
                                onTrendDaysChange={setTrendDays}
                                currency={currency}
                            />
                        </ScrollReveal>
                        <ScrollReveal variant="fade-up" delay={0.4} className="chart-section-side">
                            <CategoryDonutChart data={categoryDataWithPercent} currency={currency} />
                        </ScrollReveal>
                    </div>

                    {/* ── ZONE 3: Intelligence Band — independent balanced panels ── */}
                    <div className="dashboard-insights-zone">
                        <ScrollReveal variant="fade-up" delay={0.45} className="insights-primary">
                            <HealthScoreGauge />
                        </ScrollReveal>
                        <ScrollReveal variant="fade-up" delay={0.5} className="insights-secondary">
                            <AiInsightsPanel />
                        </ScrollReveal>
                    </div>

                    {/* ── ZONE 4: Supporting Data ── */}
                    <div className="dashboard-supporting-zone">
                        <ScrollReveal variant="fade-up" delay={0.55} className="supporting-main">
                            <TransactionList
                                transactions={filteredTransactions}
                                onViewAll={() => navigate('/expenses')}
                                currency={currency}
                            />
                        </ScrollReveal>

                        <ScrollReveal variant="fade-up" delay={0.6} className="supporting-side">
                            <div className="financial-overview-container">
                                <div className="financial-overview-label-main">FINANCIAL OVERVIEW</div>
                                <AccountsSummary accounts={accountList} currency={currency} />
                                <div className="financial-overview-divider-soft" />
                                <BudgetHealth budgets={budgetList} currency={currency} />
                            </div>
                        </ScrollReveal>
                    </div>
                </>
            )}
            </div>

        </motion.div>
    );
}
