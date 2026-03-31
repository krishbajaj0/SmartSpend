import { memo } from 'react';
import { Search } from 'lucide-react';
import Input from '../ui/Input';
import Dropdown from '../ui/Dropdown';
import CategoryBadge, { CATEGORIES } from '../ui/CategoryBadge';

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

const dateRangeOptions = [
    { label: 'All', value: 0 },
    { label: '7d', value: 7 },
    { label: '30d', value: 30 },
    { label: '90d', value: 90 },
];

function ExpenseFilters({
    searchQuery,
    categoryFilter,
    dateRange,
    sortBy,
    hasActiveFilters,
    onSearchChange,
    onCategoryChange,
    onDateRangeChange,
    onSortChange,
    onClearFilters,
}) {
    return (
        <div className="expenses-filter-bar">
            <Input
                label="Search"
                value={searchQuery}
                onChange={e => onSearchChange(e.target.value)}
                placeholder="Search merchants..."
                icon={<Search size={16} />}
            />
            <Dropdown
                label="Category"
                options={categoryFilterOptions}
                value={categoryFilter}
                onChange={onCategoryChange}
                placeholder="All Categories"
            />
            <Dropdown
                label="Sort By"
                options={sortOptions}
                value={sortBy}
                onChange={onSortChange}
            />
            <div>
                <span className="filter-date-pills" style={{ display: 'flex', gap: '4px' }}>
                    {dateRangeOptions.map(opt => (
                        <button
                            key={opt.value}
                            className={`filter-pill ${dateRange === opt.value ? 'active' : ''}`}
                            onClick={() => onDateRangeChange(opt.value)}
                        >
                            {opt.label}
                        </button>
                    ))}
                </span>
            </div>
            {hasActiveFilters && (
                <button className="filter-clear" onClick={onClearFilters}>
                    Clear filters
                </button>
            )}
        </div>
    );
}

export default memo(ExpenseFilters);
