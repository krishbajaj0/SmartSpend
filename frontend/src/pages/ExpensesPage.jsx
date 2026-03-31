import { useState, useEffect, useMemo, useCallback } from 'react';
import { useOutletContext } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Plus, Search, Grid3x3, List, ChevronLeft, ChevronRight,
    Calendar, ArrowUpDown, ArrowUp, ArrowDown, Repeat,
} from 'lucide-react';
import { format, subDays, isAfter } from 'date-fns';
import GlassCard from '../components/ui/GlassCard';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';
import Dropdown from '../components/ui/Dropdown';
import CategoryBadge, { CATEGORIES } from '../components/ui/CategoryBadge';
import EmptyState from '../components/ui/EmptyState';
import ExpenseFormModal from '../components/expenses/ExpenseFormModal';
import ExpenseDetail from '../components/expenses/ExpenseDetail';
import { useToast } from '../context/ToastContext';
import { expensesAPI } from '../utils/api';
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

    const [expenses, setExpenses] = useState([]);
    const [loadingData, setLoadingData] = useState(true);

    // Filters
    const [searchQuery, setSearchQuery] = useState('');
    const [categoryFilter, setCategoryFilter] = useState('');
    const [dateRange, setDateRange] = useState(0);
    const [sortBy, setSortBy] = useState('date-desc');

    // View state
    const [viewMode, setViewMode] = useState('card');
    const [currentPage, setCurrentPage] = useState(1);

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

    // ── Fetch expenses from API ──
    const fetchExpenses = useCallback(async () => {
        try {
            setLoadingData(true);
            const res = await expensesAPI.list({ limit: 200, sortBy: 'date', sortOrder: 'desc' });
            setExpenses(res.data.expenses || []);
        } catch (err) {
            addToast('Failed to load expenses', { type: 'error' });
        } finally {
            setLoadingData(false);
        }
    }, [addToast]);

    // Silent refetch — doesn't show loading spinner (prevents modal unmount)
    const refetchExpenses = useCallback(async () => {
        try {
            const res = await expensesAPI.list({ limit: 200, sortBy: 'date', sortOrder: 'desc' });
            setExpenses(res.data.expenses || []);
        } catch { /* silent */ }
    }, []);

    useEffect(() => { fetchExpenses(); }, [fetchExpenses]);

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
                const res = await expensesAPI.create(data);

                const newExpense = res.data.expense || res.data;

                setExpenses(prev => [newExpense, ...prev]);

                addToast('Expense added!', { type: 'success' });
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
        } catch (err) {
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
                    <h1>Expenses</h1>
                    <span className="expenses-count">{filteredExpenses.length} items</span>
                </div>
                <Button variant="primary" icon={<Plus size={18} />} onClick={openAdd}>
                    Add Expense
                </Button>
            </div>

            {/* ── Filter Bar ── */}
            <div className="expenses-filter-bar">
                <Input
                    label="Search"
                    value={searchQuery}
                    onChange={e => setFilterAndResetPage(setSearchQuery)(e.target.value)}
                    placeholder="Search merchants..."
                    icon={<Search size={16} />}
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
                <span className="expenses-sort-info">
                    Showing <strong>{paginatedExpenses.length}</strong> of{' '}
                    <strong>{filteredExpenses.length}</strong> expenses
                </span>
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
                        title={expenses.length === 0 ? 'No expenses yet' : 'No expenses found'}
                        description={expenses.length === 0
                            ? 'Add your first expense to get started.'
                            : 'Try adjusting your filters or search query.'}
                        actionLabel={expenses.length === 0 ? 'Add Expense' : 'Clear Filters'}
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
                                    className="expense-card"
                                    onClick={() => openDetail(exp)}
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
                                const cat = CATEGORIES[exp.category] || CATEGORIES.other;
                                return (
                                    <motion.tr
                                        key={exp._id || exp.id}
                                        onClick={() => openDetail(exp)}
                                        initial={{ opacity: 0 }}
                                        animate={{ opacity: 1 }}
                                        transition={{ delay: i * 0.03 }}
                                    >
                                        <td>
                                            <CategoryBadge category={exp.category} size="sm" />
                                        </td>
                                        <td className="table-merchant">{exp.merchant}</td>
                                        <td className="table-amount">
                                            ₹{(exp.amount || 0).toLocaleString('en-IN')}
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
            <ExpenseFormModal
                isOpen={formOpen}
                onClose={() => { setFormOpen(false); setEditingExpense(null); }}
                onSubmit={handleAddOrEdit}
                expense={editingExpense}
            />

            {/* ── Detail Panel ── */}
            <ExpenseDetail
                expense={detailExpense}
                isOpen={detailOpen}
                onClose={() => setDetailOpen(false)}
                onEdit={openEdit}
                onDelete={handleDelete}
            />
        </div>
    );
}
