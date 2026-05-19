import { motion } from 'framer-motion';
import { formatDistanceToNow } from 'date-fns';
import { ArrowRight, RefreshCw, ArrowDownLeft, ArrowUpRight, Settings, Wallet, CreditCard } from 'lucide-react';
import { getCategoryInfo } from '../ui/CategoryBadge';
import { formatCurrency } from '../../utils/currency';
import './TransactionList.css';

export default function TransactionList({ transactions, onViewAll, currency = 'INR' }) {
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
                    <div className="transactions-empty-state" style={{ padding: '36px var(--space-lg)', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                        <span style={{ fontSize: '28px' }}>💸</span>
                        <h4 style={{ fontSize: '0.9rem', fontWeight: '600', color: 'var(--text-primary)', margin: '0' }}>No transactions recorded yet</h4>
                        <span style={{ fontSize: '0.78rem', color: 'var(--text-tertiary)', maxWidth: '220px', lineHeight: '1.4' }}>Connect an account or click Add Transaction above to get started.</span>
                    </div>
                ) : (
                    transactions.slice(0, 8).map((tx, idx) => {
                        if (!tx) return null;
                        const isIncome = tx.type === 'INCOME';
                        const isTransfer = tx.type === 'TRANSFER';
                        const cat = getCategoryInfo(tx.category);
                        const title = tx.merchant || tx.note || tx.category || 'Transaction';
                        const subtitle = isTransfer 
                            ? `${tx.accountName} → ${tx.toAccountName}` 
                            : tx.accountName || cat.label;

                        // Merchant initial or icon
                        const initial = title.charAt(0).toUpperCase();

                        return (
                            <motion.div
                                key={tx._id || tx.id || `tx-${idx}`}
                                className="transaction-row-premium"
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: idx * 0.05 }}
                                whileHover={{ x: 5 }}
                            >
                                <div className="transaction-icon-premium" style={{ 
                                    background: isIncome ? 'rgba(16, 185, 129, 0.12)' : 
                                                 isTransfer ? 'rgba(59, 130, 246, 0.12)' : `${cat.color}15` 
                                }}>
                                    {tx.category === 'Adjustment' ? (
                                        <Settings size={18} style={{ color: isIncome ? '#10b981' : '#ef4444' }} />
                                    ) : isTransfer ? (
                                        <RefreshCw size={18} style={{ color: '#3b82f6' }} />
                                    ) : tx.merchant ? (
                                        <span className="merchant-initial" style={{ color: isIncome ? '#10b981' : cat.color }}>
                                            {initial}
                                        </span>
                                    ) : (
                                        <span className="cat-icon-small">
                                            {isIncome ? <ArrowDownLeft size={18} style={{ color: '#10b981' }} /> : cat.icon}
                                        </span>
                                    )}
                                </div>
                                <div className="transaction-info-premium">
                                    <div className="transaction-title-row">
                                        <span className="transaction-merchant">{title}</span>
                                        <span className={`transaction-amount-premium ${isIncome ? 'income' : ''}`}>
                                            {isIncome ? '+' : '-'}{formatCurrency(tx.amount || 0, currency)}
                                        </span>
                                    </div>
                                    <div className="transaction-subtitle-row">
                                        <span className="transaction-account">{subtitle}</span>
                                        <span className="transaction-time-dot">•</span>
                                        <span className="transaction-time">
                                            {tx.date ? formatDistanceToNow(new Date(tx.date), { addSuffix: true }) : '—'}
                                        </span>
                                    </div>
                                </div>
                            </motion.div>
                        );
                    })
                )}
            </div>
        </div>
    );
}
