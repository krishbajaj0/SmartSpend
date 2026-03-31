import { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, Sparkles } from 'lucide-react';
import { aiAPI } from '../../utils/api';
import { CATEGORIES } from '../ui/CategoryBadge';
import './SmartSearch.css';

const SUGGESTIONS = [
    'How much did I spend on food last month?',
    'Total shopping this week',
    'My spending yesterday',
    'Transport expenses last 7 days',
    'Bills this month',
];

export default function SmartSearch() {
    const [query, setQuery] = useState('');
    const [loading, setLoading] = useState(false);
    const [result, setResult] = useState(null);

    const handleSearch = useCallback(async (searchQuery) => {
        const q = searchQuery || query;
        if (!q.trim()) return;
        setLoading(true);
        setResult(null);
        try {
            const res = await aiAPI.query(q.trim());
            setResult(res.data);
        } catch {
            setResult(null);
        }
        setLoading(false);
    }, [query]);

    const handleKeyDown = (e) => {
        if (e.key === 'Enter') handleSearch();
    };

    const handleSuggestion = (s) => {
        setQuery(s);
        handleSearch(s);
    };

    return (
        <div className="smart-search">
            <div className="smart-search-bar">
                <Search size={18} className="search-icon" />
                <input
                    type="text"
                    value={query}
                    onChange={e => setQuery(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="Ask anything about your spending..."
                />
                {loading && <div className="search-loading" />}
            </div>

            <div className="smart-search-suggestions">
                {SUGGESTIONS.map(s => (
                    <button
                        key={s}
                        className="smart-search-suggestion"
                        onClick={() => handleSuggestion(s)}
                    >
                        <Sparkles size={10} style={{ marginRight: 4 }} />
                        {s}
                    </button>
                ))}
            </div>

            <AnimatePresence>
                {result && (
                    <motion.div
                        className="smart-search-result"
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0 }}
                    >
                        <div className="smart-search-response">
                            <Sparkles size={16} style={{ verticalAlign: 'middle', marginRight: 6, color: 'var(--accent-primary)' }} />
                            {result.response}
                        </div>

                        <div className="smart-search-details">
                            <div className="smart-search-detail">
                                <div className="detail-value">₹{(result.totalSpent || 0).toLocaleString('en-IN')}</div>
                                <div className="detail-label">Total Spent</div>
                            </div>
                            <div className="smart-search-detail">
                                <div className="detail-value">{result.transactionCount || 0}</div>
                                <div className="detail-label">Transactions</div>
                            </div>
                            <div className="smart-search-detail">
                                <div className="detail-value">₹{(result.avgAmount || 0).toLocaleString('en-IN')}</div>
                                <div className="detail-label">Average</div>
                            </div>
                        </div>

                        {result.topCategories?.length > 0 && (
                            <div className="smart-search-categories">
                                {result.topCategories.map(c => {
                                    const cat = CATEGORIES[c.category] || CATEGORIES.other;
                                    return (
                                        <span key={c.category} className="smart-search-cat-chip">
                                            {cat.icon} {cat.label}:&nbsp;<strong>₹{c.total.toLocaleString('en-IN')}</strong>
                                        </span>
                                    );
                                })}
                            </div>
                        )}
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
