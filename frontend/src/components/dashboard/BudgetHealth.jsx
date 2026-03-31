import { useMemo } from 'react';
import { motion } from 'framer-motion';
import { Target } from 'lucide-react';
import { getCategoryInfo } from '../ui/CategoryBadge';
import './BudgetHealth.css';

export default function BudgetHealth({ budgets }) {
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
