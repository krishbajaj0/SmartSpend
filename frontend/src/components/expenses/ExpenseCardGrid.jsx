import { memo } from 'react';
import { motion } from 'framer-motion';
import { format } from 'date-fns';
import { Calendar, Repeat } from 'lucide-react';
import GlassCard from '../ui/GlassCard';
import CategoryBadge, { CATEGORIES } from '../ui/CategoryBadge';

function formatExpenseDate(dateStr) {
    if (!dateStr) return '—';
    try {
        const date = new Date(dateStr);
        if (isNaN(date.getTime())) return '—';
        return format(date, 'MMM d, yyyy');
    } catch {
        return '—';
    }
}

function ExpenseCardGrid({ expenses, onExpenseClick }) {
    return (
        <motion.div
            className="expenses-card-grid"
            initial="hidden"
            animate="visible"
            variants={{
                hidden: {},
                visible: { transition: { staggerChildren: 0.04 } },
            }}
        >
            {expenses.map(exp => {
                const cat = CATEGORIES[exp.category] || CATEGORIES.other;
                return (
                    <motion.div
                        key={exp._id || exp.id}
                        variants={{
                            hidden: { opacity: 0, y: 20 },
                            visible: { opacity: 1, y: 0 },
                        }}
                        transition={{ duration: 0.3 }}
                    >
                        <GlassCard
                            className="expense-card"
                            onClick={() => onExpenseClick(exp)}
                        >
                            <div className="expense-card-top">
                                <div
                                    className="expense-card-icon"
                                    style={{ background: `${cat.color}20` }}
                                >
                                    {cat.icon}
                                </div>
                                <span className="expense-card-amount">
                                    ₹{(exp.amount || 0).toLocaleString('en-IN')}
                                </span>
                            </div>
                            <div className="expense-card-merchant">{exp.merchant}</div>
                            <div className="expense-card-meta">
                                <CategoryBadge category={exp.category} size="sm" />
                                <span className="expense-card-date">
                                    <Calendar size={12} />
                                    {formatExpenseDate(exp.date)}
                                </span>
                                {exp.isRecurring && (
                                    <span className="expense-card-recurring">
                                        <Repeat size={10} /> Recurring
                                    </span>
                                )}
                            </div>
                        </GlassCard>
                    </motion.div>
                );
            })}
        </motion.div>
    );
}

export default memo(ExpenseCardGrid);
