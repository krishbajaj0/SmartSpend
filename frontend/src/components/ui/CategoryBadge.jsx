import './CategoryBadge.css';

export const CATEGORIES = {
    overall: { label: 'Overall Budget', icon: '🏛️', color: '#ff7675' },
    food: { label: 'Food', icon: '🍔', color: '#ff7675' },
    transport: { label: 'Transport', icon: '🚗', color: '#74b9ff' },
    bills: { label: 'Bills', icon: '💡', color: '#fdcb6e' },
    shopping: { label: 'Shopping', icon: '🛒', color: '#a29bfe' },
    entertainment: { label: 'Entertainment', icon: '🎮', color: '#55efc4' },
    health: { label: 'Health', icon: '💊', color: '#fd79a8' },
    education: { label: 'Education', icon: '📚', color: '#0984e3' },
    travel: { label: 'Travel', icon: '✈️', color: '#00cec9' },
    groceries: { label: 'Groceries', icon: '🥬', color: '#00b894' },
    subscriptions: { label: 'Subscriptions', icon: '📱', color: '#6c5ce7' },
    other: { label: 'Other', icon: '📦', color: '#8892b0' },
};

export function getCategoryInfo(category) {
    if (CATEGORIES[category]) return CATEGORIES[category];
    const words = category.split(/[_\s]/);
    const label = words.map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
    return { label, icon: '📌', color: '#8892b0' };
}

export default function CategoryBadge({ category, size = 'md', className = '' }) {
    const cat = getCategoryInfo(category);

    return (
        <span
            className={`category-badge category-badge-${size} ${className}`}
            style={{ '--cat-color': cat.color }}
        >
            <span className="category-badge-icon">{cat.icon}</span>
            <span className="category-badge-label">{cat.label}</span>
        </span>
    );
}
