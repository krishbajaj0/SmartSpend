import { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Wallet, Target, Plus, ArrowUpRight, Calendar } from 'lucide-react';
import { format, differenceInDays } from 'date-fns';
import GlassCard from '../components/ui/GlassCard';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';
import Modal from '../components/ui/Modal';
import ProgressBar from '../components/ui/ProgressBar';
import ProgressRing from '../components/ui/ProgressRing';
import Dropdown from '../components/ui/Dropdown';
import EmptyState from '../components/ui/EmptyState';
import { CATEGORIES, getCategoryInfo } from '../components/ui/CategoryBadge';
import { useToast } from '../context/ToastContext';
import { budgetsAPI, goalsAPI } from '../utils/api';
import './BudgetsPage.css';

export default function BudgetsPage() {
    const location = useLocation();
    const tab = location.pathname === '/goals' ? 'goals' : 'budgets';
    const [budgetData, setBudgetData] = useState([]);
    const [goals, setGoals] = useState([]);
    const [loading, setLoading] = useState(true);
    const [contributeGoal, setContributeGoal] = useState(null);
    const [contributeAmount, setContributeAmount] = useState('');
    const [addGoalOpen, setAddGoalOpen] = useState(false);
    const [newGoal, setNewGoal] = useState({ name: '', targetAmount: '', deadline: '' });
    const [addBudgetOpen, setAddBudgetOpen] = useState(false);
    const [newBudget, setNewBudget] = useState({ category: '', limitAmount: '', customCategory: '' });
    const [transferAnim, setTransferAnim] = useState(null);
    const [overallCustomAmount, setOverallCustomAmount] = useState(0);
    const { addToast } = useToast();

    // Fetch data
    useEffect(() => {
        async function load() {
            setLoading(true);
            try {
                const [budRes, goalRes] = await Promise.allSettled([
                    budgetsAPI.list(),
                    goalsAPI.list(),
                ]);
                if (budRes.status === 'fulfilled') {
                    setBudgetData((budRes.value.data.budgets || []).map(b => ({
                        ...b,
                        spent: b.currentSpent || 0,
                        limit: b.limitAmount || 0,
                    })));
                }
                if (goalRes.status === 'fulfilled') {
                    setGoals(goalRes.value.data.goals || []);
                }
            } catch { /* silent */ }
            setLoading(false);
        }
        load();
    }, []);

    useEffect(() => {
        const overall = budgetData.find(b => b.category === 'overall');
        if (overall) {
            setOverallCustomAmount(overall.limit || 0);
        }
    }, [budgetData]);

    async function updateBudgetLimit(category, newLimit) {
        const budget = budgetData.find(b => b.category === category);
        try {
            await budgetsAPI.createOrUpdate({
                category,
                limitAmount: Number(newLimit),
                warningThreshold: budget?.warningThreshold || 75,
                criticalThreshold: budget?.criticalThreshold || 90,
            });
            setBudgetData(prev =>
                prev.map(b => b.category === category ? { ...b, limit: Number(newLimit), limitAmount: Number(newLimit) } : b)
            );
        } catch (err) {
            addToast('Failed to update budget', { type: 'error' });
        }
    }

    function updateThreshold(category, field, value) {
        setBudgetData(prev =>
            prev.map(b => b.category === category ? { ...b, [field]: Number(value) } : b)
        );
    }

    async function handleContribute() {
        if (!contributeGoal || !contributeAmount || Number(contributeAmount) <= 0) return;
        const amt = Number(contributeAmount);
        try {
            setTransferAnim(contributeGoal._id || contributeGoal.id);
            await goalsAPI.contribute(contributeGoal._id || contributeGoal.id, { amount: amt });
            // Refetch goals
            const res = await goalsAPI.list();
            setGoals(res.data.goals || []);
            addToast(`₹${amt.toLocaleString('en-IN')} added to ${contributeGoal.name}!`, { type: 'success' });
        } catch (err) {
            addToast('Failed to contribute', { type: 'error' });
        }
        setContributeGoal(null);
        setContributeAmount('');
        setTimeout(() => setTransferAnim(null), 700);
    }

    async function handleAddGoal() {
        if (!newGoal.name || !newGoal.targetAmount || !newGoal.deadline) return;
        try {
            await goalsAPI.create({
                name: newGoal.name,
                targetAmount: Number(newGoal.targetAmount),
                deadline: newGoal.deadline,
            });
            const res = await goalsAPI.list();
            setGoals(res.data.goals || []);
            setAddGoalOpen(false);
            setNewGoal({ name: '', targetAmount: '', deadline: '' });
            addToast(`Goal "${newGoal.name}" created!`, { type: 'success' });
        } catch (err) {
            addToast('Failed to create goal', { type: 'error' });
        }
    }

    async function handleAddBudget() {
        if (!newBudget.limitAmount || Number(newBudget.limitAmount) <= 0) return;
        
        const category = newBudget.category === '__custom__' 
            ? newBudget.customCategory?.toLowerCase().replace(/\s+/g, '_') || 'other'
            : newBudget.category;
            
        if (!category || (newBudget.category === '__custom__' && !newBudget.customCategory)) {
            addToast('Please select or enter a category', { type: 'error' });
            return;
        }
        
        try {
            await budgetsAPI.createOrUpdate({
                category,
                limitAmount: Number(newBudget.limitAmount),
                warningThreshold: 75,
                criticalThreshold: 90
            });
            const res = await budgetsAPI.list();
            setBudgetData((res.data.budgets || []).map(b => ({
                ...b,
                spent: b.currentSpent || 0,
                limit: b.limitAmount || 0,
            })));
            setAddBudgetOpen(false);
            setNewBudget({ category: '', limitAmount: '', customCategory: '' });
            addToast(`Budget set for ${newBudget.category === '__custom__' ? newBudget.customCategory : CATEGORIES[category]?.label || category}`, { type: 'success' });
        } catch (err) {
            addToast('Failed to create budget', { type: 'error' });
        }
    }

    if (loading) {
        return (
            <div className="budgets-page" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '40vh' }}>
                <div className="loading-spinner" />
            </div>
        );
    }

    return (
        <div className="budgets-page">
            <div className="receipts-page-header">
                <h1>{tab === 'budgets' ? 'Budget Setup' : 'Savings Goals'}</h1>
                {tab === 'goals' && (
                    <Button variant="primary" icon={<Plus size={18} />} onClick={() => setAddGoalOpen(true)}>
                        New Goal
                    </Button>
                )}
                {tab === 'budgets' && (
                    <Button variant="primary" icon={<Plus size={18} />} onClick={() => setAddBudgetOpen(true)}>
                        New Budget
                    </Button>
                )}
            </div>

            {/* ── Budgets Tab ── */}
            {tab === 'budgets' && (
                budgetData.length === 0 ? (
                    <EmptyState
                        title="No budgets configured"
                        description="Set monthly spending limits per category to stay on track."
                        actionLabel="Create Budget"
                        onAction={() => setAddBudgetOpen(true)}
                    />
                ) : (
                    <motion.div
                        className="budget-cards-grid"
                        initial="hidden"
                        animate="visible"
                        variants={{ hidden: {}, visible: { transition: { staggerChildren: 0.06 } } }}
                    >
                        {/* Overall Budget Hero Card */}
                        {(() => {
                            const b = budgetData.find(bud => bud.category === 'overall');
                            if (!b) {
                                const hasCategoryBudgets = budgetData.some(bud => bud.category !== 'overall');
                                if (hasCategoryBudgets) {
                                    return (
                                        <motion.div key="overall_cta" variants={{ hidden: { opacity: 0, y: 20 }, visible: { opacity: 1, y: 0 } }} style={{ gridColumn: '1 / -1', marginBottom: '16px' }}>
                                            <GlassCard className="budget-card-item" style={{ border: '2px dashed var(--warning)', background: 'linear-gradient(135deg, rgba(253,203,110,0.1), rgba(0,0,0,0.2))', textAlign: 'center', padding: 'var(--space-xl)' }}>
                                                <div style={{ marginBottom: 'var(--space-md)' }}>
                                                    <Wallet size={40} style={{ color: 'var(--warning)' }} />
                                                </div>
                                                <h3 style={{ marginBottom: 'var(--space-sm)', color: 'var(--text-primary)' }}>Set Your Overall Monthly Budget</h3>
                                                <p style={{ color: 'var(--text-secondary)', marginBottom: 'var(--space-lg)', maxWidth: '400px', margin: '0 auto var(--space-lg)' }}>
                                                    Define a master spending limit to track your total monthly expenses across all categories.
                                                </p>
                                                <Button variant="primary" icon={<Plus size={18} />} onClick={() => {
                                                    setNewBudget({ category: 'overall', limitAmount: '' });
                                                    setAddBudgetOpen(true);
                                                }}>
                                                    Set Overall Budget
                                                </Button>
                                            </GlassCard>
                                        </motion.div>
                                    );
                                }
                                return null;
                            }
                            const cat = CATEGORIES.overall || { label: 'Overall Month Limit', icon: '🏛️', color: '#ff7675' };
                            return (
                                <motion.div key="overall_hero" variants={{ hidden: { opacity: 0, y: 20 }, visible: { opacity: 1, y: 0 } }} style={{ gridColumn: '1 / -1', marginBottom: '16px' }}>
                                    <GlassCard className="budget-card-item" style={{ border: '1px solid var(--border-accent)', background: 'linear-gradient(135deg, rgba(255,118,117,0.1), rgba(0,0,0,0.3))' }}>
                                        <div className="budget-card-header">
                                            <div className="budget-card-category">
                                                <div className="budget-card-cat-icon" style={{ background: `${cat.color}20` }}>
                                                    {cat.icon}
                                                </div>
                                                <span className="budget-card-cat-name" style={{ fontSize: '1.2rem', fontWeight: 'bold' }}>{cat.label}</span>
                                            </div>
                                            <span className="budget-card-amounts">
                                                <strong>₹{(b.spent || 0).toLocaleString()}</strong> / ₹{(b.limit || 0).toLocaleString()}
                                            </span>
                                        </div>
                                        <ProgressBar value={b.spent || 0} max={b.limit || 1} showPercentage size="md" />
                                        <div className="budget-slider-wrapper" style={{ marginTop: 'var(--space-md)' }}>
                                            <div className="budget-slider-label">
                                                <span>Master Monthly Limit</span>
                                                <span>₹{(overallCustomAmount || 0).toLocaleString()}</span>
                                            </div>
                                            <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                                                <input
                                                    type="range"
                                                    className="budget-slider"
                                                    min="1000"
                                                    max="100000"
                                                    step="1000"
                                                    value={overallCustomAmount || 0}
                                                    onChange={e => setOverallCustomAmount(Number(e.target.value))}
                                                    style={{ flex: 1 }}
                                                />
                                                <input
                                                    type="number"
                                                    value={overallCustomAmount}
                                                    onChange={e => setOverallCustomAmount(Number(e.target.value))}
                                                    onBlur={() => updateBudgetLimit('overall', overallCustomAmount)}
                                                    onKeyDown={e => e.key === 'Enter' && updateBudgetLimit('overall', overallCustomAmount)}
                                                    style={{
                                                        width: '120px',
                                                        padding: '8px 12px',
                                                        background: 'var(--bg-input)',
                                                        border: '1px solid var(--border-subtle)',
                                                        borderRadius: 'var(--radius-md)',
                                                        color: 'var(--text-primary)',
                                                        fontSize: '1rem',
                                                    }}
                                                    placeholder="Custom"
                                                />
                                            </div>
                                        </div>
                                    </GlassCard>
                                </motion.div>
                            );
                        })()}

                        {/* Regular Category Cards */}
                        {budgetData.filter(b => b.category !== 'overall').map(b => {
                            const cat = getCategoryInfo(b.category);
                            return (
                                <motion.div
                                    key={b.category}
                                    variants={{ hidden: { opacity: 0, y: 20 }, visible: { opacity: 1, y: 0 } }}
                                >
                                    <GlassCard className="budget-card-item">
                                        <div className="budget-card-header">
                                            <div className="budget-card-category">
                                                <div className="budget-card-cat-icon" style={{ background: `${cat.color}20` }}>
                                                    {cat.icon}
                                                </div>
                                                <span className="budget-card-cat-name">{cat.label}</span>
                                            </div>
                                            <span className="budget-card-amounts">
                                                <strong>₹{(b.spent || 0).toLocaleString()}</strong> / ₹{(b.limit || 0).toLocaleString()}
                                            </span>
                                        </div>
                                        <ProgressBar value={b.spent || 0} max={b.limit || 1} showPercentage size="sm" />
                                        <div className="budget-slider-wrapper">
                                            <div className="budget-slider-label">
                                                <span>Monthly Limit</span>
                                                <span>₹{(b.limit || 0).toLocaleString()}</span>
                                            </div>
                                            <input
                                                type="range"
                                                className="budget-slider"
                                                min="500"
                                                max="20000"
                                                step="500"
                                                value={b.limit || 0}
                                                onChange={e => updateBudgetLimit(b.category, e.target.value)}
                                            />
                                        </div>
                                        <div className="budget-thresholds">
                                            <div className="budget-threshold">
                                                <span className="threshold-warning">⚠️ Warning</span>
                                                <input
                                                    type="number"
                                                    value={b.warningThreshold || 75}
                                                    min="50"
                                                    max="95"
                                                    onChange={e => updateThreshold(b.category, 'warningThreshold', e.target.value)}
                                                />
                                                <span>%</span>
                                            </div>
                                            <div className="budget-threshold">
                                                <span className="threshold-critical">🔴 Critical</span>
                                                <input
                                                    type="number"
                                                    value={b.criticalThreshold || 90}
                                                    min="60"
                                                    max="100"
                                                    onChange={e => updateThreshold(b.category, 'criticalThreshold', e.target.value)}
                                                />
                                                <span>%</span>
                                            </div>
                                        </div>
                                    </GlassCard>
                                </motion.div>
                            );
                        })}
                    </motion.div>
                )
            )}

            {/* ── Savings Goals Tab ── */}
            {tab === 'goals' && (
                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
                    {goals.length === 0 ? (
                        <EmptyState
                            title="No savings goals"
                            description="Set a goal to start saving towards something meaningful."
                            actionLabel="Create Goal"
                            onAction={() => setAddGoalOpen(true)}
                        />
                    ) : (
                        <div className="goals-grid">
                            {goals.map((g, i) => {
                                const daysLeft = differenceInDays(new Date(g.deadline), new Date());
                                const pct = (g.currentAmount / g.targetAmount) * 100;
                                return (
                                    <motion.div
                                        key={g._id || g.id}
                                        initial={{ opacity: 0, y: 20 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        transition={{ delay: i * 0.08 }}
                                    >
                                        <GlassCard className={`goal-card ${transferAnim === (g._id || g.id) ? 'transfer-animation' : ''}`}>
                                            <ProgressRing
                                                value={g.currentAmount}
                                                max={g.targetAmount}
                                                size={130}
                                                strokeWidth={10}
                                                color={g.status === 'completed' ? 'var(--success)' : undefined}
                                                milestones={g.milestones}
                                            />
                                            <div>
                                                <div className="goal-card-name">{g.name}</div>
                                                <div className="goal-card-target">
                                                    <strong>₹{g.currentAmount.toLocaleString()}</strong> / ₹{g.targetAmount.toLocaleString()}
                                                </div>
                                                <div className="goal-card-deadline">
                                                    <Calendar size={12} style={{ verticalAlign: 'middle', marginRight: 4 }} />
                                                    {g.status === 'completed'
                                                        ? '🎉 Goal reached!'
                                                        : daysLeft > 0
                                                            ? `${daysLeft} days left — ${format(new Date(g.deadline), 'MMM d, yyyy')}`
                                                            : 'Deadline passed'}
                                                </div>
                                            </div>
                                            {g.status === 'active' && (
                                                <div className="goal-card-actions">
                                                    <Button
                                                        variant="primary"
                                                        size="sm"
                                                        icon={<ArrowUpRight size={14} />}
                                                        onClick={() => { setContributeGoal(g); setContributeAmount(''); }}
                                                    >
                                                        Contribute
                                                    </Button>
                                                </div>
                                            )}
                                        </GlassCard>
                                    </motion.div>
                                );
                            })}
                        </div>
                    )}
                </motion.div>
            )}

            {/* Contribute Modal */}
            <Modal
                isOpen={!!contributeGoal}
                onClose={() => setContributeGoal(null)}
                title={`Contribute to ${contributeGoal?.name || ''}`}
                size="sm"
            >
                <div className="contribute-form">
                    <div className="amount-display">
                        <div className="amount-value">₹{contributeAmount || '0'}</div>
                    </div>
                    <Input
                        label="Amount"
                        type="number"
                        value={contributeAmount}
                        onChange={e => setContributeAmount(e.target.value)}
                        placeholder="Enter amount to contribute"
                        min="1"
                    />
                    <div className="contribute-form-actions">
                        <Button variant="ghost" onClick={() => setContributeGoal(null)}>Cancel</Button>
                        <Button variant="primary" onClick={handleContribute}>Add Funds</Button>
                    </div>
                </div>
            </Modal>

            {/* Add Goal Modal */}
            <Modal
                isOpen={addGoalOpen}
                onClose={() => setAddGoalOpen(false)}
                title="Create Savings Goal"
                size="sm"
            >
                <div className="add-goal-form">
                    <Input
                        label="Goal Name"
                        value={newGoal.name}
                        onChange={e => setNewGoal(p => ({ ...p, name: e.target.value }))}
                        placeholder="e.g. Emergency Fund"
                    />
                    <Input
                        label="Target Amount (₹)"
                        type="number"
                        value={newGoal.targetAmount}
                        onChange={e => setNewGoal(p => ({ ...p, targetAmount: e.target.value }))}
                        placeholder="100000"
                        min="1"
                    />
                    <div className="date-input-wrapper" style={{ marginTop: '-8px' }}>
                        <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '6px', fontWeight: 500 }}>
                            Deadline
                        </label>
                        <input
                            type="date"
                            value={newGoal.deadline}
                            onChange={e => setNewGoal(p => ({ ...p, deadline: e.target.value }))}
                            style={{
                                background: 'var(--bg-input)',
                                border: '1px solid var(--border-subtle)',
                                borderRadius: 'var(--radius-md)',
                                padding: '12px 14px',
                                color: 'var(--text-primary)',
                                fontSize: '0.95rem',
                                fontFamily: 'var(--font-body)',
                                width: '100%',
                            }}
                        />
                    </div>
                    <div className="add-goal-actions">
                        <Button variant="ghost" onClick={() => setAddGoalOpen(false)}>Cancel</Button>
                        <Button variant="primary" onClick={handleAddGoal}>Create Goal</Button>
                    </div>
                </div>
            </Modal>

            {/* Add Budget Modal */}
            <Modal
                isOpen={addBudgetOpen}
                onClose={() => setAddBudgetOpen(false)}
                title="Create Custom Budget"
                size="sm"
            >
                <div className="add-goal-form">
                    <Dropdown
                        label="Category"
                        options={[
                            ...Object.entries(CATEGORIES).map(([value, { label, icon }]) => ({ value, label: `${icon} ${label}` })),
                            { value: '__custom__', label: '✏️ Custom Category' }
                        ]}
                        value={newBudget.category}
                        onChange={val => setNewBudget(p => ({ ...p, category: val, customCategory: val === '__custom__' ? p.customCategory : '' }))}
                        placeholder="Select category"
                    />
                    {newBudget.category === '__custom__' && (
                        <Input
                            label="Custom Category Name"
                            value={newBudget.customCategory}
                            onChange={e => setNewBudget(p => ({ ...p, customCategory: e.target.value }))}
                            placeholder="e.g. Gaming, Gifts, etc."
                        />
                    )}
                    <Input
                        label="Monthly Limit (₹)"
                        type="number"
                        value={newBudget.limitAmount}
                        onChange={e => setNewBudget(p => ({ ...p, limitAmount: e.target.value }))}
                        placeholder="e.g. 5000"
                        min="1"
                    />
                    <div className="add-goal-actions">
                        <Button variant="ghost" onClick={() => setAddBudgetOpen(false)}>Cancel</Button>
                        <Button variant="primary" onClick={handleAddBudget}>Create Budget</Button>
                    </div>
                </div>
            </Modal>
        </div>
    );
}
