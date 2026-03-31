import { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
    AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip,
    ResponsiveContainer, PieChart, Pie, Cell,
} from 'recharts';
import { formatDistanceToNow, format, subDays, eachDayOfInterval, startOfDay } from 'date-fns';
import {
    TrendingUp, Wallet, CreditCard, PiggyBank, ArrowRight, ArrowUpRight, ArrowDownRight,
    Plus, Receipt, FileText, Sparkles, Zap, Clock, Target, Lightbulb, X,
} from 'lucide-react';
import GlassCard from '../components/ui/GlassCard';
import AnimatedCounter from '../components/ui/AnimatedCounter';
import ProgressBar from '../components/ui/ProgressBar';
import EmptyState from '../components/ui/EmptyState';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';
import { CATEGORIES, getCategoryInfo } from '../components/ui/CategoryBadge';
import ScrollReveal, { ScrollRevealItem } from '../components/ScrollReveal';
import { dashboardAPI, budgetsAPI, expensesAPI } from '../utils/api';
import './DashboardPage.css';

const CHART_COLORS = ['#8b5cf6', '#6366f1', '#14b8a6', '#f59e0b', '#ef4444', '#3b82f6', '#ec4899'];

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

function StatCard({ label, value, prefix = '', icon, color, change, changeType, delay = 0, sparklineData }) {
    const Icon = icon;
    const isPositive = changeType === 'up';
    const isNegative = changeType === 'down';

    return (
        <motion.div
            variants={itemVariants}
            initial="hidden"
            animate="visible"
            transition={{ delay, duration: 0.5 }}
            className="stat-card-premium"
            style={{ 
                '--card-color': color,
                background: `linear-gradient(135deg, ${color}15 0%, ${color}05 100%)` 
            }}
            whileHover={{ y: -6, transition: { duration: 0.2 } }}
        >
            <div className="stat-card-header-premium">
                <span className="stat-card-label-premium">{label}</span>
                <div className="stat-card-icon-premium" style={{
                    background: `${color}15`,
                    border: `1px solid ${color}30`
                }}>
                    <Icon size={20} style={{ color }} />
                </div>
            </div>
            <div className="stat-card-value-premium">
                <span className="stat-card-prefix">{prefix}</span>
                <AnimatedCounter value={value} duration={1500} />
            </div>
            <div className="stat-card-footer">
                {/* Empty footer area to preserve card height consistency if needed */}
            </div>
        </motion.div>
    );
}

function getGreetingAndInsight(summary, previousWeekTotal) {
    const hour = new Date().getHours();
    let greeting;
    if (hour < 12) greeting = 'Good morning';
    else if (hour < 17) greeting = 'Good afternoon';
    else greeting = 'Good evening';

    const currentTotal = summary?.totalSpent || 0;
    const previousTotal = previousWeekTotal || 0;
    let insight = '';

    if (previousTotal > 0) {
        const changePercent = ((currentTotal - previousTotal) / previousTotal) * 100;
        if (changePercent < 0) {
            insight = `You spent ${Math.abs(changePercent).toFixed(0)}% less than last week.`;
        } else if (changePercent > 0) {
            insight = `You spent ${changePercent.toFixed(0)}% more than last week.`;
        } else {
            insight = 'Your spending is about the same as last week.';
        }
    } else if (currentTotal > 0) {
        insight = `You've spent ₹${currentTotal.toLocaleString()} this month.`;
    } else {
        insight = 'Start tracking your expenses to get insights.';
    }

    return { greeting, insight };
}

function SparklineChart({ data, color = '#8b5cf6' }) {
    const points = useMemo(() => {
        if (!data?.length) return '';
        const max = Math.max(...data);
        const min = Math.min(...data);
        const range = max - min || 1;
        const width = 100;
        const height = 40;
        return data.map((val, i) => {
            const x = (i / (data.length - 1)) * width;
            const y = height - ((val - min) / range) * height;
            return `${x},${y}`;
        }).join(' ');
    }, [data]);

    return (
        <svg viewBox="0 0 100 40" className="sparkline-chart">
            <defs>
                <linearGradient id={`sparkGrad-${color}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={color} stopOpacity="0.3" />
                    <stop offset="100%" stopColor={color} stopOpacity="0" />
                </linearGradient>
            </defs>
            <polyline
                fill="none"
                stroke={color}
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                points={points}
            />
        </svg>
    );
}



function CustomTooltip({ active, payload, label }) {
    if (!active || !payload?.length) return null;
    return (
        <motion.div
            className="chart-tooltip-premium"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2 }}
        >
            <p className="chart-tooltip-label">{label}</p>
            <p className="chart-tooltip-value">₹{payload[0].value.toLocaleString()}</p>
        </motion.div>
    );
}

function AISearchBar({ onSearch, onSuggestionClick }) {
    const [query, setQuery] = useState('');
    const [focused, setFocused] = useState(false);

    const suggestions = [
        "How much did I spend on food last month?",
        "Total shopping this week",
        "My spending yesterday",
        "Entertainment expenses this month",
    ];

    const handleSubmit = (e) => {
        e.preventDefault();
        if (query.trim()) {
            onSearch?.(query);
        }
    };

    return (
        <motion.div
            className={`ai-search-container ${focused ? 'focused' : ''}`}
            animate={{ scale: focused ? 1.02 : 1 }}
        >
            <div className="ai-search-icon">
                <Sparkles size={20} />
            </div>
            <form onSubmit={handleSubmit} className="ai-search-form">
                <input
                    type="text"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    onFocus={() => setFocused(true)}
                    onBlur={() => setFocused(false)}
                    placeholder="Ask SmartSpend AI about your spending..."
                    className="ai-search-input"
                />
                <button type="submit" className="ai-search-btn">
                    <Zap size={18} />
                </button>
            </form>
            <AnimatePresence>
                {focused && (
                    <motion.div
                        className="ai-suggestions"
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                    >
                        <div className="ai-suggestions-label">Suggested questions</div>
                        {suggestions.map((s, i) => (
                            <button
                                key={i}
                                className="ai-suggestion-chip"
                                onClick={() => {
                                    setQuery(s);
                                    onSuggestionClick?.(s);
                                }}
                            >
                                {s}
                            </button>
                        ))}
                    </motion.div>
                )}
            </AnimatePresence>
        </motion.div>
    );
}

function BudgetHealthWidget({ budgets, onCreateBudget: _onCreateBudget }) {
    const sortedBudgets = useMemo(() => {
        return [...budgets]
            .filter(b => b.category !== 'overall')
            .sort((a, b) => {
                const aPct = (a.spent || a.currentSpent || 0) / (a.limit || a.limitAmount || 1);
                const bPct = (b.spent || b.currentSpent || 0) / (b.limit || b.limitAmount || 1);
                return bPct - aPct;
            })
            .slice(0, 4);
    }, [budgets]);

    const getStatusColor = (pct) => {
        if (pct >= 100) return 'var(--danger)';
        if (pct >= 80) return 'var(--warning)';
        return 'var(--success)';
    };

    return (
        <div className="budget-health-widget">
            <div className="budget-health-header">
                <Target size={18} />
                <h3>Budget Health</h3>
            </div>
            <div className="budget-health-list">
                {sortedBudgets.length === 0 ? (
                    <motion.div
                        className="budget-health-empty"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                    >
                        <div className="budget-empty-icon">📊</div>
                        <p>No budgets set yet</p>
                        <button
                            className="budget-create-btn"
                            onClick={() => window.location.href = '/budgets'}
                        >
                            Create Budget
                        </button>
                    </motion.div>
                ) : (
                    sortedBudgets.map((b) => {
                        const spent = b.spent || b.currentSpent || 0;
                        const limit = b.limit || b.limitAmount || 1;
                        const pct = Math.min((spent / limit) * 100, 100);
                        const cat = getCategoryInfo(b.category);
                        return (
                            <div key={b.category} className="budget-health-item">
                                <div className="budget-health-item-header">
                                    <span className="budget-health-cat">
                                        {cat.icon} {cat.label}
                                    </span>
                                    <span className="budget-health-values">
                                        ₹{spent.toLocaleString()} / ₹{limit.toLocaleString()}
                                    </span>
                                </div>
                                <div className="budget-health-bar">
                                    <motion.div
                                        className="budget-health-bar-fill"
                                        initial={{ width: 0 }}
                                        animate={{ width: `${pct}%` }}
                                        transition={{ duration: 0.8, ease: 'easeOut' }}
                                        style={{ background: getStatusColor(pct) }}
                                    />
                                </div>
                            </div>
                        );
                    })
                )}
            </div>
        </div>
    );
}

function AIInsightCard({ budgets, recentExpenses }) {
    const insight = useMemo(() => {
        const categoryTotals = {};
        recentExpenses?.forEach(exp => {
            const cat = exp.category || 'other';
            categoryTotals[cat] = (categoryTotals[cat] || 0) + (exp.amount || 0);
        });

        const foodBudget = budgets.find(b => b.category === 'food');
        const shoppingBudget = budgets.find(b => b.category === 'shopping');

        const foodSpent = foodBudget?.spent || foodBudget?.currentSpent || 0;
        const shoppingSpent = shoppingBudget?.spent || shoppingBudget?.currentSpent || 0;
        const foodLimit = foodBudget?.limit || foodBudget?.limitAmount || 1;
        const shoppingLimit = shoppingBudget?.limit || shoppingBudget?.limitAmount || 1;

        const foodPct = (foodSpent / foodLimit) * 100;
        const shoppingPct = (shoppingSpent / shoppingLimit) * 100;

        const suggestions = [];
        let type = 'good';
        let text = '';

        if (foodPct > 100) {
            type = 'warning';
            text = `You've exceeded your Food budget by ₹${(foodSpent - foodLimit).toLocaleString()}`;
            suggestions.push('Try meal prepping to reduce food expenses');
            suggestions.push('Look for deals and discounts on groceries');
        } else if (foodPct > 80) {
            type = 'caution';
            text = `You've used ${Math.round(foodPct)}% of your Food budget`;
            suggestions.push('Consider cooking at home more often');
        } else if (shoppingPct > 80) {
            type = 'caution';
            text = `Shopping expenses are at ${Math.round(shoppingPct)}% of budget`;
            suggestions.push('Wait 24 hours before non-essential purchases');
        } else if (categoryTotals.food && categoryTotals.entertainment) {
            const foodTotal = categoryTotals.food;
            const entTotal = categoryTotals.entertainment || 0;
            if (foodTotal > entTotal * 1.5) {
                type = 'info';
                text = `You spent ${Math.round((foodTotal / (entTotal || 1)))}x more on food than entertainment`;
                suggestions.push('Consider balancing your spending on experiences');
            } else {
                text = `Great job! You're managing your spending well`;
                suggestions.push('Keep up the good financial habits!');
            }
        } else {
            text = 'Your spending looks balanced this month';
            suggestions.push('Continue tracking to maintain control');
        }

        return { type, text, suggestions };
    }, [budgets, recentExpenses]);

    const getIcon = () => {
        switch (insight?.type) {
            case 'warning': return '⚠️';
            case 'caution': return '📊';
            case 'info': return '💡';
            default: return '✨';
        }
    };

    return (
        <motion.div
            className={`ai-insight-card ${insight?.type || 'good'}`}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.5, duration: 0.4 }}
            whileHover={{ scale: 1.02 }}
        >
            <div className="ai-insight-icon">
                <Lightbulb size={20} />
            </div>
            <div className="ai-insight-content">
                <span className="ai-insight-label">
                    <span className="ai-insight-emoji">{getIcon()}</span>
                    AI Insight
                </span>
                <p className="ai-insight-text">{insight?.text}</p>
                {insight?.suggestions?.length > 0 && (
                    <div className="ai-insight-suggestions">
                        {insight.suggestions.map((s, i) => (
                            <motion.div
                                key={i}
                                className="ai-suggestion-item"
                                initial={{ opacity: 0, x: -10 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{ delay: 0.6 + i * 0.1 }}
                            >
                                <span className="ai-suggestion-bullet">→</span>
                                <span>{s}</span>
                            </motion.div>
                        ))}
                    </div>
                )}
            </div>
        </motion.div>
    );
}

function QuickActions() {
    const actions = [
        { icon: Plus, label: 'Add Expense', color: '#8b5cf6', path: '/expenses?action=add' },
        { icon: Receipt, label: 'Scan Receipt', color: '#14b8a6', path: '/receipts' },
        { icon: FileText, label: 'Generate Report', color: '#6366f1', path: '/analytics' },
    ];

    return (
        <div className="quick-actions">
            {actions.map((a, i) => (
                <motion.button
                    key={a.label}
                    className="quick-action-btn"
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: 0.3 + i * 0.1 }}
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => window.location.href = a.path}
                >
                    <div className="quick-action-icon" style={{ background: `${a.color}20`, color: a.color }}>
                        <a.icon size={18} />
                    </div>
                    <span>{a.label}</span>
                </motion.button>
            ))}
        </div>
    );
}

function FloatingAddButton({ onClick }) {
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

export default function DashboardPage() {
    const navigate = useNavigate();
    const [recentExpenses, setRecentExpenses] = useState([]);
    const [budgetList, setBudgetList] = useState([]);
    const [summary, setSummary] = useState({ totalSpent: 0, totalTransactions: 0, avgDaily: 0 });
    const [categoryData, setCategoryData] = useState([]);
    const [allExpenses, setAllExpenses] = useState([]);
    const [trendDays, setTrendDays] = useState(30);
    const [overallBudgetLimit, setOverallBudgetLimit] = useState(0);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');

    const loadDashboard = useCallback(async () => {
        setLoading(true);
        try {
            const [dashboardRes, expensesRes, budgetsRes] = await Promise.all([
                dashboardAPI.load(),
                expensesAPI.list({ limit: 200, sortBy: 'date', sortOrder: 'desc' }),
                budgetsAPI.getStatus()
            ]);

            const data = dashboardRes.data;
            const expenses = expensesRes.data.expenses || [];
            const budgetData = budgetsRes.data.status || [];

            const overallBudget = budgetData.find(b => b.category === 'overall');
            setOverallBudgetLimit(overallBudget ? overallBudget.limit : 0);

            // Save raw data into refs or separate state if needed, but for now we filter dynamically in useMemo below
            setRecentExpenses(data.recentExpenses || []);
            setBudgetList(data.budgets || budgetData);
            setSummary(data.summary || { totalSpent: 0, totalTransactions: 0, avgDaily: 0 });
            setCategoryData((data.categoryBreakdown || []).map(b => ({
                name: b.category,
                value: b.amount || 0,
            })));
            setAllExpenses(expenses);
        } catch (err) {
            console.error("Dashboard load failed:", err);
        }
        setLoading(false);
    }, []);

    useEffect(() => { loadDashboard(); }, [loadDashboard]);

    useEffect(() => {
        const handler = () => loadDashboard();
        window.addEventListener('expenseUpdated', handler);
        return () => window.removeEventListener('expenseUpdated', handler);
    }, [loadDashboard]);

    const filteredExpensesMemo = useMemo(() => {
        if (!searchQuery.trim()) return allExpenses;
        
        const query = searchQuery.toLowerCase();
        return allExpenses.filter(e => {
            const matchMerchant = (e.merchant || '').toLowerCase().includes(query);
            const matchCategory = (e.category || '').toLowerCase().includes(query);
            const matchAmount = (e.amount || '').toString().includes(query);
            return matchMerchant || matchCategory || matchAmount;
        });
    }, [allExpenses, searchQuery]);

    const trendData = useMemo(() => {
        const now = new Date();
        const from = subDays(now, trendDays);
        const end = now; // Include everything up to the current moment

        const filtered = filteredExpensesMemo.filter(e => {
            if (!e.date) return false;
            const expenseDate = new Date(e.date);
            return expenseDate >= from && expenseDate <= end;
        });

        const dayMap = {};
        filtered.forEach(e => {
            const dateKey = format(new Date(e.date), 'yyyy-MM-dd');
            dayMap[dateKey] = (dayMap[dateKey] || 0) + (e.amount || 0);
        });

        const dayInterval = eachDayOfInterval({ start: from, end: end });

        return dayInterval.map(day => {
            const dateKey = format(day, 'yyyy-MM-dd');
            return {
                date: dateKey,
                label: format(day, 'MMM d'),
                amount: Math.round(dayMap[dateKey] || 0),
            };
        });
    }, [filteredExpensesMemo, trendDays]);

    const previousWeekTotal = useMemo(() => {
        const now = new Date();
        const thisWeekStart = subDays(now, 7);
        const lastWeekStart = subDays(now, 14);

        return filteredExpensesMemo
            .filter(e => {
                if (!e.date) return false;
                const expenseDate = new Date(e.date);
                return expenseDate >= lastWeekStart && expenseDate < thisWeekStart;
            })
            .reduce((sum, e) => sum + (e.amount || 0), 0);
    }, [filteredExpensesMemo]);

    const displaySummary = useMemo(() => {
        if (!searchQuery.trim()) return summary;
        
        const total = filteredExpensesMemo.reduce((acc, exp) => acc + (exp.amount || 0), 0);
        return {
            totalSpent: total,
            totalTransactions: filteredExpensesMemo.length,
            avgDaily: filteredExpensesMemo.length > 0 ? total / 30 : 0, 
        };
    }, [filteredExpensesMemo, searchQuery, summary]);

    const greetingData = useMemo(() => {
        return getGreetingAndInsight(displaySummary, previousWeekTotal);
    }, [displaySummary, previousWeekTotal]);

    const totalSavings = useMemo(() => {
        if (!overallBudgetLimit) return 0;
        return Math.max(0, overallBudgetLimit - (displaySummary.totalSpent || 0));
    }, [displaySummary.totalSpent, overallBudgetLimit]);

    const categoryDataWithPercent = useMemo(() => {
        let baseCategoryData = categoryData;
        
        if (searchQuery.trim()) {
            const catMap = {};
            filteredExpensesMemo.forEach(e => {
                const c = e.category || 'other';
                catMap[c] = (catMap[c] || 0) + (e.amount || 0);
            });
            baseCategoryData = Object.entries(catMap).map(([name, value]) => ({ name, value }));
        }

        const total = baseCategoryData.reduce((s, c) => s + c.value, 0);
        return baseCategoryData.map(c => ({
            ...c,
            percentage: total > 0 ? Math.round((c.value / total) * 100) : 0,
        }));
    }, [categoryData, filteredExpensesMemo, searchQuery]);

    const pieChartData = useMemo(() => {
        return categoryDataWithPercent.slice(0, 6).map((c, i) => ({
            ...c,
            color: CHART_COLORS[i % CHART_COLORS.length]
        }));
    }, [categoryDataWithPercent]);

    const totalCategorySpend = useMemo(() => {
        return pieChartData.reduce((s, c) => s + c.value, 0);
    }, [pieChartData]);

    const statCards = useMemo(() => {

        return [
            {
                label: 'Total Spent',
                value: displaySummary.totalSpent || 0,
                prefix: '₹',
                icon: TrendingUp,
                color: '#ef4444',
            },
            {
                label: 'Monthly Budget',
                value: overallBudgetLimit,
                prefix: '₹',
                icon: Wallet,
                color: '#8b5cf6',
            },
            {
                label: 'Transactions',
                value: displaySummary.totalTransactions || 0,
                prefix: '',
                icon: CreditCard,
                color: '#14b8a6',
            },
            {
                label: 'Remaining',
                value: totalSavings,
                prefix: '₹',
                icon: PiggyBank,
                color: '#10b981',
            },
        ];
    }, [displaySummary, overallBudgetLimit, totalSavings, trendData]);

    const displayedRecentExpenses = useMemo(() => {
        if (!searchQuery.trim()) return recentExpenses;
        return filteredExpensesMemo.slice(0, 6);
    }, [searchQuery, recentExpenses, filteredExpensesMemo]);

    const isEmpty = displayedRecentExpenses.length === 0 && !loading && !searchQuery;

    if (loading) {
        return <LoadingSkeleton />;
    }

    return (
        <motion.div
            className="dashboard-premium"
            variants={containerVariants}
            initial="hidden"
            animate="visible"
        >
            <div className="dashboard-background">
                <div className="dashboard-bg-gradient" />
                <div className="dashboard-bg-grid" />
            </div>

            <ScrollReveal variant="fade-up">
                <div className="dashboard-hero-premium">
                    <div className="hero-content">
                        <h1 className="dashboard-hero-title">
                            {greetingData.greeting.split(' ')[0]} <span className="text-gradient">{greetingData.greeting.split(' ')[1]}</span> 👋
                        </h1>
                        <p className="dashboard-hero-subtitle">
                            {format(new Date(), 'EEEE, MMMM d, yyyy')}
                        </p>

                    </div>
                    <QuickActions />
                </div>
            </ScrollReveal>

            <ScrollReveal stagger className="dashboard-stats-premium">
                {statCards.map((card, i) => (
                    <ScrollRevealItem key={card.label} variant="fade-up" delay={i * 0.1}>
                        <StatCard {...card} />
                    </ScrollRevealItem>
                ))}
            </ScrollReveal>

            <ScrollReveal variant="fade-up" delay={0.2}>
                <AISearchBar
                    onSearch={(q) => setSearchQuery(q)}
                    onSuggestionClick={(q) => setSearchQuery(q)}
                />
            </ScrollReveal>

            {isEmpty ? (
                <ScrollReveal variant="fade-up">
                    <EmptyState
                        title="No expenses yet"
                        description="Add your first expense to see your financial overview come to life."
                        actionLabel="Add Expense"
                        onAction={() => navigate('/expenses')}
                    />
                </ScrollReveal>
            ) : (
                <div className="dashboard-charts-premium">
                    <ScrollReveal variant="fade-up" delay={0.3} className="chart-section-main">
                        <GlassCard className="chart-card-premium" padding={false}>
                            <div className="chart-header-premium">
                                <h3>Spending Trend</h3>
                                <div className="chart-toggles">
                                    {[7, 30, 90].map(d => (
                                        <button
                                            key={d}
                                            className={`chart-toggle ${trendDays === d ? 'active' : ''}`}
                                            onClick={() => setTrendDays(d)}
                                        >
                                            {d}d
                                        </button>
                                    ))}
                                </div>
                            </div>
                            <div className="chart-container-premium">
                                {trendData.length > 0 ? (
                                    <ResponsiveContainer width="100%" height={320}>
                                        <AreaChart data={trendData} margin={{ top: 20, right: 20, left: -20, bottom: 0 }}>
                                            <defs>
                                                <linearGradient id="areaGradPremium" x1="0" y1="0" x2="0" y2="1">
                                                    <stop offset="0%" stopColor="#8b5cf6" stopOpacity={0.4} />
                                                    <stop offset="50%" stopColor="#8b5cf6" stopOpacity={0.15} />
                                                    <stop offset="100%" stopColor="#8b5cf6" stopOpacity={0} />
                                                </linearGradient>
                                                <filter id="chartGlow" x="-50%" y="-50%" width="200%" height="200%">
                                                    <feGaussianBlur stdDeviation="3" result="coloredBlur" />
                                                    <feMerge>
                                                        <feMergeNode in="coloredBlur" />
                                                        <feMergeNode in="SourceGraphic" />
                                                    </feMerge>
                                                </filter>
                                            </defs>
                                            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                                            <XAxis
                                                dataKey="label"
                                                stroke="var(--text-tertiary)"
                                                fontSize={12}
                                                tickLine={false}
                                                axisLine={false}
                                                dy={10}
                                            />
                                            <YAxis
                                                stroke="var(--text-tertiary)"
                                                fontSize={12}
                                                tickLine={false}
                                                axisLine={false}
                                                tickFormatter={v => `₹${(v / 1000).toFixed(0)}k`}
                                                dx={-10}
                                            />
                                            <RechartsTooltip content={<CustomTooltip />} />
                                            <Area
                                                type="monotone"
                                                dataKey="amount"
                                                stroke="#8b5cf6"
                                                strokeWidth={3}
                                                fillOpacity={1}
                                                fill="url(#areaGradPremium)"
                                                animationDuration={1500}
                                                filter="url(#chartGlow)"
                                            />
                                        </AreaChart>
                                    </ResponsiveContainer>
                                ) : (
                                    <div className="chart-empty">
                                        <p>No spending data for this period</p>
                                    </div>
                                )}
                            </div>
                        </GlassCard>
                    </ScrollReveal>

                    <ScrollReveal variant="fade-up" delay={0.4} className="chart-section-side">
                        <GlassCard className="chart-card-premium donut-card" padding={false}>
                            <div className="chart-header-premium">
                                <h3>Categories</h3>
                            </div>
                            <div className="chart-container-premium donut-container">
                                {pieChartData.length > 0 ? (
                                    <>
                                        <ResponsiveContainer width="100%" height={260}>
                                            <PieChart>
                                                <Pie
                                                    data={pieChartData}
                                                    cx="50%"
                                                    cy="50%"
                                                    innerRadius={70}
                                                    outerRadius={100}
                                                    paddingAngle={3}
                                                    dataKey="value"
                                                    animationBegin={300}
                                                    animationDuration={1200}
                                                    animationEasing="ease-out"
                                                >
                                                    {pieChartData.map((entry, i) => (
                                                        <Cell
                                                            key={entry.name}
                                                            fill={entry.color}
                                                            style={{
                                                                filter: 'drop-shadow(0 0 8px rgba(139, 92, 246, 0.3))',
                                                                transform: 'scale(1)',
                                                                transformOrigin: 'center',
                                                                transition: 'all 0.3s ease',
                                                            }}
                                                        />
                                                    ))}
                                                </Pie>
                                                <RechartsTooltip
                                                    formatter={(value) => [`₹${value.toLocaleString()}`, '']}
                                                    contentStyle={{
                                                        background: 'var(--bg-card-solid)',
                                                        border: '1px solid var(--border-glow)',
                                                        borderRadius: 'var(--radius-md)',
                                                        color: 'var(--text-primary)',
                                                        boxShadow: 'var(--shadow-xl)',
                                                    }}
                                                />
                                            </PieChart>
                                        </ResponsiveContainer>
                                        <motion.div
                                            className="donut-center-label"
                                            initial={{ opacity: 0, scale: 0.8 }}
                                            animate={{ opacity: 1, scale: 1 }}
                                            transition={{ delay: 0.8, duration: 0.4 }}
                                        >
                                            <span className="donut-center-value">₹{totalCategorySpend.toLocaleString()}</span>
                                            <span className="donut-center-text">Total</span>
                                        </motion.div>
                                        <div className="donut-legend-premium">
                                            {pieChartData.slice(0, 4).map((cat, _i) => (
                                                <div key={cat.name} className="donut-legend-item">
                                                    <span className="donut-legend-dot" style={{ background: cat.color }} />
                                                    <span className="donut-legend-label">
                                                        {getCategoryInfo(cat.name).icon} {getCategoryInfo(cat.name).label}
                                                    </span>
                                                    <span className="donut-legend-value">₹{cat.value.toLocaleString()}</span>
                                                </div>
                                            ))}
                                        </div>
                                    </>
                                ) : (
                                    <div className="chart-empty">
                                        <p>No category data yet</p>
                                    </div>
                                )}
                            </div>
                        </GlassCard>
                    </ScrollReveal>
                </div>
            )}

            <div className="dashboard-bottom-premium">
                <ScrollReveal variant="fade-up" delay={0.5} className="bottom-section">
                    <GlassCard className="transactions-card-premium" padding={false}>
                        <div className="chart-header-premium">
                            <h3>Recent Transactions</h3>
                            <a href="/expenses" className="view-all-link">
                                View All <ArrowRight size={14} />
                            </a>
                        </div>
                        <div className="transactions-list-premium">
                            {displayedRecentExpenses.length === 0 ? (
                                <p className="transactions-empty">No transactions match your search</p>
                            ) : (
                                displayedRecentExpenses.slice(0, 6).map((exp, idx) => {
                                    const cat = getCategoryInfo(exp.category);
                                    return (
                                        <motion.div
                                            key={exp._id || exp.id}
                                            className="transaction-row-premium"
                                            initial={{ opacity: 0, x: -10 }}
                                            animate={{ opacity: 1, x: 0 }}
                                            transition={{ delay: idx * 0.06 }}
                                            whileHover={{ backgroundColor: 'var(--bg-hover)' }}
                                        >
                                            <div className="transaction-icon-premium" style={{ background: `${cat.color}20` }}>
                                                <span style={{ fontSize: '1.2rem' }}>{cat.icon}</span>
                                            </div>
                                            <div className="transaction-info-premium">
                                                <span className="transaction-merchant">{exp.merchant}</span>
                                                <span className="transaction-time">
                                                    {exp.date ? formatDistanceToNow(new Date(exp.date), { addSuffix: true }) : '—'}
                                                </span>
                                            </div>
                                            <span className="transaction-amount-premium">
                                                -₹{(exp.amount || 0).toLocaleString()}
                                            </span>
                                        </motion.div>
                                    );
                                })
                            )}
                        </div>
                    </GlassCard>
                </ScrollReveal>

                <ScrollReveal variant="fade-up" delay={0.6} className="bottom-section">
                    <BudgetHealthWidget budgets={budgetList} />
                    <AIInsightCard budgets={budgetList} recentExpenses={recentExpenses} />
                </ScrollReveal>
            </div>

            <FloatingAddButton onClick={() => navigate('/expenses?action=add')} />
        </motion.div>
    );
}
