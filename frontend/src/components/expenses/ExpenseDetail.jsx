import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Edit3, Trash2, Repeat, Calendar, Store, StickyNote, Tag } from 'lucide-react';
import { format } from 'date-fns';
import Button from '../ui/Button';
import { CATEGORIES } from '../ui/CategoryBadge';
import CategoryBadge from '../ui/CategoryBadge';
import ConfirmDialog from '../ui/ConfirmDialog';
import './ExpenseDetail.css';

export default function ExpenseDetail({ expense, isOpen, onClose, onEdit, onDelete }) {
    const [confirmOpen, setConfirmOpen] = useState(false);
    const [deleting, setDeleting] = useState(false);

    if (!expense) return null;

    const cat = CATEGORIES[expense.category] || CATEGORIES.other;

    async function handleDelete() {
        setDeleting(true);
        onDelete(expense._id || expense.id);
        setDeleting(false);
        setConfirmOpen(false);
        onClose();
    }

    return (
        <>
            <AnimatePresence>
                {isOpen && (
                    <>
                        <motion.div
                            className="expense-detail-backdrop"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            onClick={onClose}
                        />
                        <motion.div
                            className="expense-detail-panel"
                            initial={{ x: '100%' }}
                            animate={{ x: 0 }}
                            exit={{ x: '100%' }}
                            transition={{ type: 'spring', damping: 30, stiffness: 300 }}
                        >
                            {/* Header */}
                            <div className="expense-detail-header">
                                <h3>Expense Details</h3>
                                <div className="expense-detail-header-actions">
                                    <button
                                        className="expense-detail-close"
                                        onClick={onClose}
                                        aria-label="Close"
                                    >
                                        <X size={18} />
                                    </button>
                                </div>
                            </div>

                            {/* Body */}
                            <div className="expense-detail-body">
                                {/* Amount */}
                                <div className="expense-detail-amount">
                                    <div className="expense-detail-amount-value">
                                        ₹{(expense.amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                                    </div>
                                    <div className="expense-detail-amount-label">
                                        {expense.merchant}
                                    </div>
                                </div>

                                {/* Info rows */}
                                <div className="expense-detail-info">
                                    <div className="expense-detail-row">
                                        <div
                                            className="expense-detail-row-icon"
                                            style={{ background: `${cat.color}20`, color: cat.color }}
                                        >
                                            {cat.icon}
                                        </div>
                                        <div className="expense-detail-row-content">
                                            <span className="expense-detail-row-label">Category</span>
                                            <span className="expense-detail-row-value">
                                                <CategoryBadge category={expense.category} />
                                            </span>
                                        </div>
                                    </div>

                                    <div className="expense-detail-row">
                                        <div
                                            className="expense-detail-row-icon"
                                            style={{ background: 'rgba(var(--accent-primary-rgb), 0.12)' }}
                                        >
                                            <Store size={18} style={{ color: 'var(--accent-primary)' }} />
                                        </div>
                                        <div className="expense-detail-row-content">
                                            <span className="expense-detail-row-label">Merchant</span>
                                            <span className="expense-detail-row-value">{expense.merchant}</span>
                                        </div>
                                    </div>

                                    <div className="expense-detail-row">
                                        <div
                                            className="expense-detail-row-icon"
                                            style={{ background: 'rgba(var(--accent-secondary-rgb), 0.12)' }}
                                        >
                                            <Calendar size={18} style={{ color: 'var(--accent-secondary)' }} />
                                        </div>
                                        <div className="expense-detail-row-content">
                                            <span className="expense-detail-row-label">Date</span>
                                            <span className="expense-detail-row-value">
                                                {expense.date ? format(new Date(expense.date), 'EEEE, MMMM d, yyyy') : '—'}
                                            </span>
                                        </div>
                                    </div>

                                    {expense.notes && (
                                        <div className="expense-detail-row">
                                            <div
                                                className="expense-detail-row-icon"
                                                style={{ background: 'rgba(253, 203, 110, 0.12)' }}
                                            >
                                                <StickyNote size={18} style={{ color: '#fdcb6e' }} />
                                            </div>
                                            <div className="expense-detail-row-content">
                                                <span className="expense-detail-row-label">Notes</span>
                                                <span className="expense-detail-notes">{expense.notes}</span>
                                            </div>
                                        </div>
                                    )}

                                    {expense.tags && expense.tags.length > 0 && (
                                        <div className="expense-detail-row">
                                            <div
                                                className="expense-detail-row-icon"
                                                style={{ background: 'rgba(var(--accent-primary-rgb), 0.12)' }}
                                            >
                                                <Tag size={18} style={{ color: 'var(--accent-primary)' }} />
                                            </div>
                                            <div className="expense-detail-row-content">
                                                <span className="expense-detail-row-label">Tags</span>
                                                <div className="expense-detail-tags">
                                                    {expense.tags.map(tag => (
                                                        <span key={tag} className="expense-detail-tag">
                                                            {tag}
                                                        </span>
                                                    ))}
                                                </div>
                                            </div>
                                        </div>
                                    )}

                                    {expense.isRecurring && (
                                        <div className="expense-detail-recurring">
                                            <Repeat size={14} />
                                            Recurring expense
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Footer actions */}
                            <div className="expense-detail-footer">
                                <Button
                                    variant="secondary"
                                    icon={<Edit3 size={16} />}
                                    onClick={() => onEdit(expense)}
                                >
                                    Edit
                                </Button>
                                <Button
                                    variant="danger"
                                    icon={<Trash2 size={16} />}
                                    onClick={() => setConfirmOpen(true)}
                                >
                                    Delete
                                </Button>
                            </div>
                        </motion.div>
                    </>
                )}
            </AnimatePresence>

            <ConfirmDialog
                isOpen={confirmOpen}
                onClose={() => setConfirmOpen(false)}
                onConfirm={handleDelete}
                title="Delete Expense"
                message={`Delete ₹${(expense.amount || 0).toLocaleString()} spent at ${expense.merchant || 'Unknown'}? This cannot be undone.`}
                confirmLabel="Delete"
                loading={deleting}
            />
        </>
    );
}
