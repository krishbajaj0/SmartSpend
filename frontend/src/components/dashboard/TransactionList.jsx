import { motion } from 'framer-motion';
import { formatDistanceToNow } from 'date-fns';
import { ArrowRight } from 'lucide-react';
import { getCategoryInfo } from '../ui/CategoryBadge';
import './TransactionList.css';

export default function TransactionList({ transactions, onViewAll }) {
    return (
        <div className="transactions-card-premium">
            <div className="chart-header-premium">
                <h3>Recent Transactions</h3>
                <button className="view-all-link" onClick={onViewAll}>
                    View All <ArrowRight size={14} />
                </button>
            </div>
            <div className="transactions-list-premium">
                {transactions.length === 0 ? (
                    <p className="transactions-empty">No transactions yet</p>
                ) : (
                    transactions.slice(0, 6).map((exp, idx) => {
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
        </div>
    );
}
