import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useOutletContext } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Plus, Search, Grid3x3, List, ChevronLeft, ChevronRight,
    Calendar, ArrowUpDown, ArrowUp, ArrowDown, Repeat,
    Trash2, CheckSquare, Square, X,
} from 'lucide-react';
import { format, subDays, isAfter } from 'date-fns';
import GlassCard from '../components/ui/GlassCard';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';
import Dropdown from '../components/ui/Dropdown';
import CategoryBadge, { CATEGORIES } from '../components/ui/CategoryBadge';
import EmptyState from '../components/ui/EmptyState';
import TransactionModal from '../components/expenses/TransactionModal';
import ExpenseDetail from '../components/expenses/ExpenseDetail';
import { useToast } from '../context/ToastContext';
import { useAuth } from '../context/AuthContext';
import { expensesAPI, transactionsAPI } from '../utils/api';
import { formatCurrency } from '../utils/currency';
import './ExpensesPage.css';

const ITEMS_PER_PAGE = 10;

const categoryFilterOptions = [
    { value: '', label: 'All Categories' },
    ...Object.entries(CATEGORIES).map(([value, { label, icon }]) => ({
        value,
        label: `${icon} ${label}`,
    })),
];

const sortOptions = [
    { value: 'date-desc', label: '📅 Newest first' },
    { value: 'date-asc', label: '📅 Oldest first' },
    { value: 'amount-desc', label: '💰 Highest amount' },
    { value: 'amount-asc', label: '💰 Lowest amount' },
    { value: 'merchant-asc', label: '🏪 Merchant A–Z' },
    { value: 'merchant-desc', label: '🏪 Merchant Z–A' },
];

export default function ExpensesPage() {
    const outletContext = useOutletContext() || {};
    const { showAddExpense, setShowAddExpense } = outletContext;
    const { user } = useAuth();
    const currency = user?.currency || 'INR';

    const [expenses, setExpenses] = useState([]);
    const [loadingData, setLoadingData] = useState(true);

    // Filters
    const [inputValue, setInputValue] = useState('');
    const [searchQuery, setSearchQuery] = useState('');
    const [isSearching, setIsSearching] = useState(false);
    const searchTimeout = useRef(null);

    const handleSearchChange = useCallback((value) => {
        setIsSearching(true);
        if (searchTimeout.current) clearTimeout(searchTimeout.current);

        searchTimeout.current = setTimeout(() => {
            setSearchQuery(value);
            setCurrentPage(1);
            setIsSearching(false);
        }, 400);
    }, []);

    useEffect(() => {
        return () => {
            if (searchTimeout.current) clearTimeout(searchTimeout.current);
        };
    }, []);

    const [categoryFilter, setCategoryFilter] = useState('');
    const [dateRange, setDateRange] = useState(0);
    const [sortBy, setSortBy] = useState('date-desc');

    // View state
    const [viewMode, setViewMode] = useState('card');
    const [currentPage, setCurrentPage] = useState(1);

    // Multi-select state
    const [selectedIds, setSelectedIds] = useState(new Set());
    const [bulkDeleting, setBulkDeleting] = useState(false);

    // Modals / panels
    const [formOpen, setFormOpen] = useState(false);
    const [editingExpense, setEditingExpense] = useState(null);
    const [detailExpense, setDetailExpense] = useState(null);
    const [detailOpen, setDetailOpen] = useState(false);

    const { addToast } = useToast();

    // Open form when header Add Expense button is clicked
    useEffect(() => {
        if (showAddExpense) {
            setEditingExpense(null);
            setFormOpen(true);
            setShowAddExpense?.(false);
        }
    }, [showAddExpense, setShowAddExpense]);

    useEffect(() => {
        const controller = new AbortController();
        const fetchTransactions = async () => {
            try {
                setLoadingData(true);
                const res = await transactionsAPI.list(
                    { limit: 200 },
                    { signal: controller.signal }
                );
                setExpenses(res.data.transactions || []);
            } catch (err) {
                if (err.name !== 'CanceledError' && err.code !== 'ERR_CANCELED') {
                    addToast('Failed to load transactions', { type: 'error' });
                }
            } finally {
                setLoadingData(false);
            }
        };

        fetchTransactions();
        return () => controller.abort();
    }, [addToast]);

    // ── Filtered + sorted data ──
    const filteredExpenses = useMemo(() => {
        let result = [...expenses];

        if (searchQuery.trim()) {
            const q = searchQuery.toLowerCase();
            result = result.filter(e =>
                (e.merchant || '').toLowerCase().includes(q) ||
                (e.category || '').toLowerCase().includes(q) ||
                (e.notes || '').toLowerCase().includes(q)
            );
        }
        if (categoryFilter) {
            result = result.filter(e => e.category === categoryFilter);
        }
        if (dateRange > 0) {
            const cutoff = subDays(new Date(), dateRange);
            result = result.filter(e => e.date && isAfter(new Date(e.date), cutoff));
        }

        const [field, dir] = sortBy.split('-');
        result.sort((a, b) => {
            let cmp = 0;
            if (field === 'date') cmp = new Date(a.date || 0) - new Date(b.date || 0);
            else if (field === 'amount') cmp = (a.amount || 0) - (b.amount || 0);
            else if (field === 'merchant') cmp = (a.merchant || '').localeCompare(b.merchant || '');
            return dir === 'desc' ? -cmp : cmp;
        });

        return result;
    }, [expenses, searchQuery, categoryFilter, dateRange, sortBy]);

    // ── Pagination ──
    const totalPages = Math.max(1, Math.ceil(filteredExpenses.length / ITEMS_PER_PAGE));
    const safePage = Math.min(currentPage, totalPages);
    const paginatedExpenses = filteredExpenses.slice(
        (safePage - 1) * ITEMS_PER_PAGE,
        safePage * ITEMS_PER_PAGE
    );

    const setFilterAndResetPage = useCallback((setter) => (val) => {
        setter(val);
        setCurrentPage(1);
    }, []);

    // ── CRUD handlers (real API) ──
    async function handleAddOrEdit(data) {
        try {
            if (data._id || data.id) {
                const id = data._id || data.id;

                const res = await expensesAPI.update(id, data);

                setExpenses(prev =>
                    prev.map(e =>
                        (e._id === id || e.id === id) ? res.data.expense : e
                    )
                );

                addToast('Expense updated!', { type: 'success' });

            } else {
                let res;
                if (data.type === 'EXPENSE') {
                    res = await transactionsAPI.createExpense(data);
                } else if (data.type === 'INCOME') {
                    res = await transactionsAPI.createIncome(data);
                } else if (data.type === 'TRANSFER') {
                    res = await transactionsAPI.createTransfer(data);
                }

                // For simplicity, we'll refetch or add the transaction if it's an expense
                // Since ExpensesPage primarily shows expenses, we only add to list if it's an expense
                if (data.type === 'EXPENSE') {
                    const newExpense = res.data.expense || res.data;
                    setExpenses(prev => [newExpense, ...prev]);
                    addToast('Expense added!', { type: 'success' });
                } else {
                    addToast(`${data.type.charAt(0) + data.type.slice(1).toLowerCase()} recorded!`, { type: 'success' });
                }
            }

            setFormOpen(false);
            setEditingExpense(null);
            window.dispatchEvent(new Event('expenseUpdated'));

        } catch (err) {
            addToast(err?.response?.data?.message || 'Failed to save expense', { type: 'error' });
        }
    }
    async function handleDelete(id) {
        try {
            await expensesAPI.delete(id);
            // Optimistic state update — no refetch needed
            setExpenses(prev => prev.filter(e => (e._id || e.id) !== id));
            addToast('Expense deleted.', { type: 'success' });
            setDetailOpen(false);
            window.dispatchEvent(new Event('expenseUpdated'));
        } catch {
            addToast('Failed to delete expense', { type: 'error' });
        }
    }

    function openAdd() {
        setEditingExpense(null);
        setFormOpen(true);
    }

    function openEdit(expense) {
        setDetailOpen(false);
        setEditingExpense(expense);
        setFormOpen(true);
    }

    function openDetail(expense) {
        setDetailExpense(expense);
        setDetailOpen(true);
    }

    function clearFilters() {
        setSearchQuery('');
        setCategoryFilter('');
        setDateRange(0);
        setSortBy('date-desc');
        setCurrentPage(1);
    }

    const hasActiveFilters = searchQuery || categoryFilter || dateRange > 0 || sortBy !== 'date-desc';

    // ── Multi-select helpers ──
    function toggleSelect(id) {
        setSelectedIds(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    }

    function toggleSelectAll() {
        if (selectedIds.size === paginatedExpenses.length) {
            setSelectedIds(new Set());
        } else {
            setSelectedIds(new Set(paginatedExpenses.map(e => e._id || e.id)));
        }
    }

    async function handleBulkDelete() {
        if (selectedIds.size === 0) return;
        const count = selectedIds.size;
        if (!window.confirm(`Delete ${count} selected expense${count > 1 ? 's' : ''}? This cannot be undone.`)) return;
        try {
            setBulkDeleting(true);
            await expensesAPI.bulkDelete([...selectedIds]);
            setExpenses(prev => prev.filter(e => !selectedIds.has(e._id) && !selectedIds.has(e.id)));
            addToast(`${count} expense${count > 1 ? 's' : ''} deleted`, { type: 'success' });
            setSelectedIds(new Set());
            window.dispatchEvent(new Event('expenseUpdated'));
        } catch {
            addToast('Failed to delete expenses', { type: 'error' });
        } finally {
            setBulkDeleting(false);
        }
    }

    function getSortIcon(field) {
        const [currentField, dir] = sortBy.split('-');
        if (currentField !== field) return <ArrowUpDown size={12} />;
        return dir === 'asc' ? <ArrowUp size={12} /> : <ArrowDown size={12} />;
    }

    function toggleTableSort(field) {
        const [currentField, dir] = sortBy.split('-');
        if (currentField === field) {
            setSortBy(`${field}-${dir === 'asc' ? 'desc' : 'asc'}`);
        } else {
            setSortBy(`${field}-desc`);
        }
        setCurrentPage(1);
    }

    if (loadingData) {
        return (
            <div className="expenses-page" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '40vh' }}>
                <div className="loading-spinner" />
            </div>
        );
    }

    return (
        <div className="expenses-page">
            {/* ── Page Header ── */}
            <div className="expenses-page-header">
                <div className="expenses-page-header-left">
                    <h1>Transactions</h1>
                    <span className="expenses-count">{filteredExpenses.length} items</span>
                </div>
                <Button variant="primary" icon={<Plus size={18} />} onClick={openAdd}>
                    Add Transaction
                </Button>
            </div>

            {/* ── Filter Bar ── */}
            <div className="expenses-filter-bar">
                <Input
                    label="Search"
                    value={inputValue}
                    onChange={e => {
                        setInputValue(e.target.value);
                        handleSearchChange(e.target.value);
                    }}
                    placeholder="Search merchants..."
                    icon={isSearching ? <div className="loading-spinner" style={{width: 12, height: 12, borderWidth: 2}} /> : <Search size={16} />}
                />
                <Dropdown
                    label="Category"
                    options={categoryFilterOptions}
                    value={categoryFilter}
                    onChange={setFilterAndResetPage(setCategoryFilter)}
                    placeholder="All Categories"
                />
                <Dropdown
                    label="Sort By"
                    options={sortOptions}
                    value={sortBy}
                    onChange={setFilterAndResetPage(setSortBy)}
                />
                <div>
                    <span className="filter-date-pills" style={{ display: 'flex', gap: '4px' }}>
                        {[
                            { label: 'All', value: 0 },
                            { label: '7d', value: 7 },
                            { label: '30d', value: 30 },
                            { label: '90d', value: 90 },
                        ].map(opt => (
                            <button
                                key={opt.value}
                                className={`filter-pill ${dateRange === opt.value ? 'active' : ''}`}
                                onClick={() => setFilterAndResetPage(setDateRange)(opt.value)}
                            >
                                {opt.label}
                            </button>
                        ))}
                    </span>
                </div>
                {hasActiveFilters && (
                    <button className="filter-clear" onClick={clearFilters}>
                        Clear filters
                    </button>
                )}
            </div>

            {/* ── Toolbar ── */}
            <div className="expenses-toolbar">
                <div className="expenses-toolbar-left">
                    <button
                        className="select-all-btn"
                        onClick={toggleSelectAll}
                        title={selectedIds.size === paginatedExpenses.length ? 'Deselect all' : 'Select all'}
                    >
                        {selectedIds.size === paginatedExpenses.length && paginatedExpenses.length > 0
                            ? <CheckSquare size={16} />
                            : <Square size={16} />
                        }
                    </button>
                    <span className="expenses-sort-info">
                        Showing <strong>{paginatedExpenses.length}</strong> of{' '}
                        <strong>{filteredExpenses.length}</strong> transactions
                    </span>
                </div>
                <div className="view-toggle">
                    <button
                        className={`view-toggle-btn ${viewMode === 'card' ? 'active' : ''}`}
                        onClick={() => setViewMode('card')}
                        aria-label="Card view"
                    >
                        {viewMode === 'card' && (
                            <motion.span className="view-toggle-bg" layoutId="viewToggle" />
                        )}
                        <Grid3x3 size={16} />
                    </button>
                    <button
                        className={`view-toggle-btn ${viewMode === 'table' ? 'active' : ''}`}
                        onClick={() => setViewMode('table')}
                        aria-label="Table view"
                    >
                        {viewMode === 'table' && (
                            <motion.span className="view-toggle-bg" layoutId="viewToggle" />
                        )}
                        <List size={16} />
                    </button>
                </div>
            </div>

            {/* ── Content ── */}
            {paginatedExpenses.length === 0 ? (
                <div className="expenses-empty-wrapper">
                    <EmptyState
                        title={expenses.length === 0 ? 'No transactions yet' : 'No transactions found'}
                        description={expenses.length === 0
                            ? 'Add your first transaction to get started.'
                            : 'Try adjusting your filters or search query.'}
                        actionLabel={expenses.length === 0 ? 'Add Transaction' : 'Clear Filters'}
                        onAction={expenses.length === 0 ? openAdd : clearFilters}
                    />
                </div>
            ) : viewMode === 'card' ? (
                <motion.div
                    className="expenses-card-grid"
                    initial="hidden"
                    animate="visible"
                    variants={{
                        hidden: {},
                        visible: { transition: { staggerChildren: 0.04 } },
                    }}
                >
                    {paginatedExpenses.map(exp => {
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
                                    className={`expense-card ${selectedIds.has(exp._id || exp.id) ? 'selected' : ''}`}
                                    onClick={() => openDetail(exp)}
                                >
                                    <div className="expense-card-top">
                                        <button
                                            className="expense-card-checkbox"
                                            onClick={(e) => { e.stopPropagation(); toggleSelect(exp._id || exp.id); }}
                                        >
                                            {selectedIds.has(exp._id || exp.id)
                                                ? <CheckSquare size={16} className="checked" />
                                                : <Square size={16} />
                                            }
                                        </button>
                                        <div
                                            className="expense-card-icon"
                                            style={{ background: `${cat.color}20` }}
                                        >
                                            {cat.icon}
                                        </div>
                                        <span className="expense-card-amount">
                                            {formatCurrency(exp.amount || 0, currency)}
                                        </span>
                                    </div>
                                    <div className="expense-card-merchant">{exp.merchant || exp.note || 'Transaction'}</div>
                                    <div className="expense-card-meta">
                                        <CategoryBadge category={exp.category} size="sm" />
                                        <span className="expense-card-date">
                                            <Calendar size={12} />
                                            {exp.date ? format(new Date(exp.date), 'MMM d, yyyy') : '—'}
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
            ) : (
                <motion.div
                    className="expenses-table-wrapper"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3 }}
                >
                    <table className="expenses-table">
                        <thead>
                            <tr>
                                <th className="th-checkbox">
                                    <button className="table-checkbox-btn" onClick={toggleSelectAll}>
                                        {selectedIds.size === paginatedExpenses.length && paginatedExpenses.length > 0
                                            ? <CheckSquare size={14} />
                                            : <Square size={14} />
                                        }
                                    </button>
                                </th>
                                <th>Category</th>
                                <th
                                    className={sortBy.startsWith('merchant') ? 'sorted' : ''}
                                    onClick={() => toggleTableSort('merchant')}
                                >
                                    Merchant
                                    <span className="sort-icon">{getSortIcon('merchant')}</span>
                                </th>
                                <th
                                    className={sortBy.startsWith('amount') ? 'sorted' : ''}
                                    onClick={() => toggleTableSort('amount')}
                                >
                                    Amount
                                    <span className="sort-icon">{getSortIcon('amount')}</span>
                                </th>
                                <th
                                    className={sortBy.startsWith('date') ? 'sorted' : ''}
                                    onClick={() => toggleTableSort('date')}
                                >
                                    Date
                                    <span className="sort-icon">{getSortIcon('date')}</span>
                                </th>
                                <th>Status</th>
                            </tr>
                        </thead>
                        <tbody>
                            {paginatedExpenses.map((exp, i) => {
                                return (
                                    <motion.tr
                                        key={exp._id || exp.id}
                                        onClick={() => openDetail(exp)}
                                        initial={{ opacity: 0 }}
                                        animate={{ opacity: 1 }}
                                        transition={{ delay: i * 0.03 }}
                                    >
                                        <td className="td-checkbox">
                                            <button
                                                className="table-checkbox-btn"
                                                onClick={(e) => { e.stopPropagation(); toggleSelect(exp._id || exp.id); }}
                                            >
                                                {selectedIds.has(exp._id || exp.id)
                                                    ? <CheckSquare size={14} className="checked" />
                                                    : <Square size={14} />
                                                }
                                            </button>
                                        </td>
                                        <td>
                                            <CategoryBadge category={exp.category} size="sm" />
                                        </td>
                                        <td className="table-merchant">{exp.merchant}</td>
                                        <td className="table-amount">
                                            {formatCurrency(exp.amount || 0, currency)}
                                        </td>
                                        <td className="table-date">
                                            {format(new Date(exp.date), 'MMM d, yyyy')}
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
            )}

            {/* ── Pagination ── */}
            {filteredExpenses.length > ITEMS_PER_PAGE && (
                <div className="expenses-pagination">
                    <button
                        className="pagination-btn"
                        onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                        disabled={safePage <= 1}
                    >
                        <ChevronLeft size={16} /> Prev
                    </button>
                    <span className="expenses-pagination-info">
                        Page {safePage} of {totalPages}
                    </span>
                    <button
                        className="pagination-btn"
                        onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                        disabled={safePage >= totalPages}
                    >
                        Next <ChevronRight size={16} />
                    </button>
                </div>
            )}

            {/* ── Add / Edit Modal ── */}
            <TransactionModal
                isOpen={formOpen}
                onClose={() => { setFormOpen(false); setEditingExpense(null); }}
                onSubmit={handleAddOrEdit}
                transaction={editingExpense}
            />

            {/* ── Detail Panel ── */}
            <ExpenseDetail
                expense={detailExpense}
                isOpen={detailOpen}
                onClose={() => setDetailOpen(false)}
                onEdit={openEdit}
                onDelete={handleDelete}
                currency={currency}
            />

            {/* ── Floating Bulk Action Bar ── */}
            <AnimatePresence>
                {selectedIds.size > 0 && (
                    <motion.div
                        className="bulk-action-bar"
                        initial={{ opacity: 0, y: 40 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 40 }}
                        transition={{ type: 'spring', damping: 20, stiffness: 300 }}
                    >
                        <span className="bulk-action-count">
                            {selectedIds.size} selected
                        </span>
                        <button
                            className="bulk-action-delete"
                            onClick={handleBulkDelete}
                            disabled={bulkDeleting}
                        >
                            <Trash2 size={14} />
                            {bulkDeleting ? 'Deleting...' : 'Delete'}
                        </button>
                        <button
                            className="bulk-action-cancel"
                            onClick={() => setSelectedIds(new Set())}
                        >
                            <X size={14} />
                        </button>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
