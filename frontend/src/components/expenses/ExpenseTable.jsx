import { memo, useCallback } from 'react';
import { motion } from 'framer-motion';
import { format } from 'date-fns';
import { ArrowUpDown, ArrowUp, ArrowDown, Repeat } from 'lucide-react';
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

function ExpenseTable({
    expenses,
    sortBy,
    onSortChange,
    onRowClick,
}) {
    const getSortIcon = useCallback((field) => {
        const [currentField, dir] = sortBy.split('-');
        if (currentField !== field) return <ArrowUpDown size={12} />;
        return dir === 'asc' ? <ArrowUp size={12} /> : <ArrowDown size={12} />;
    }, [sortBy]);

    const handleKeyDown = useCallback((e, expense) => {
        if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onRowClick(expense);
        }
    }, [onRowClick]);

    const handleSortClick = useCallback((field) => {
        const [currentField, dir] = sortBy.split('-');
        if (currentField === field) {
            onSortChange(`${field}-${dir === 'asc' ? 'desc' : 'asc'}`);
        } else {
            onSortChange(`${field}-desc`);
        }
    }, [sortBy, onSortChange]);

    return (
        <motion.div
            className="expenses-table-wrapper"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
        >
            <table className="expenses-table">
                <thead>
                    <tr>
                        <th>Category</th>
                        <th
                            className={sortBy.startsWith('merchant') ? 'sorted' : ''}
                            onClick={() => handleSortClick('merchant')}
                            onKeyDown={(e) => e.key === 'Enter' && handleSortClick('merchant')}
                            tabIndex={0}
                            role="button"
                            aria-sort={sortBy.startsWith('merchant') ? (sortBy.includes('asc') ? 'ascending' : 'descending') : 'none'}
                            aria-label="Sort by merchant"
                        >
                            Merchant
                            <span className="sort-icon">{getSortIcon('merchant')}</span>
                        </th>
                        <th
                            className={sortBy.startsWith('amount') ? 'sorted' : ''}
                            onClick={() => handleSortClick('amount')}
                            onKeyDown={(e) => e.key === 'Enter' && handleSortClick('amount')}
                            tabIndex={0}
                            role="button"
                            aria-sort={sortBy.startsWith('amount') ? (sortBy.includes('asc') ? 'ascending' : 'descending') : 'none'}
                            aria-label="Sort by amount"
                        >
                            Amount
                            <span className="sort-icon">{getSortIcon('amount')}</span>
                        </th>
                        <th
                            className={sortBy.startsWith('date') ? 'sorted' : ''}
                            onClick={() => handleSortClick('date')}
                            onKeyDown={(e) => e.key === 'Enter' && handleSortClick('date')}
                            tabIndex={0}
                            role="button"
                            aria-sort={sortBy.startsWith('date') ? (sortBy.includes('asc') ? 'ascending' : 'descending') : 'none'}
                            aria-label="Sort by date"
                        >
                            Date
                            <span className="sort-icon">{getSortIcon('date')}</span>
                        </th>
                        <th>Status</th>
                    </tr>
                </thead>
                <tbody>
                    {expenses.map((exp, i) => {
                        return (
                            <motion.tr
                                key={exp._id || exp.id}
                                onClick={() => onRowClick(exp)}
                                onKeyDown={(e) => handleKeyDown(e, exp)}
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                transition={{ delay: i * 0.03 }}
                                role="button"
                                tabIndex={0}
                                aria-label={`Expense: ${exp.merchant}, ₹${exp.amount || 0}, ${formatExpenseDate(exp.date)}`}
                            >
                                <td>
                                    <CategoryBadge category={exp.category} size="sm" />
                                </td>
                                <td className="table-merchant">{exp.merchant || '—'}</td>
                                <td className="table-amount">
                                    ₹{(exp.amount || 0).toLocaleString('en-IN')}
                                </td>
                                <td className="table-date">
                                    {formatExpenseDate(exp.date)}
                                </td>
                                <td>
                                    {exp.isRecurring && (
                                        <span className="table-recurring">
                                            <Repeat size={10} /> Recurring
                                        </span>
                                    )}
                                </td>
                            </motion.tr>
                        );
                    })}
                </tbody>
            </table>
        </motion.div>
    );
}

export default memo(ExpenseTable);
