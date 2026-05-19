import { useState, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, Sparkles, X, MessageSquare, ArrowRight } from 'lucide-react';
import { aiAPI } from '../../utils/api';
import { CATEGORIES } from '../ui/CategoryBadge';
import { formatCurrency } from '../../utils/currency';
import './SmartSearch.css';

const SUGGESTIONS = [
    'How much did I spend on food last month?',
    'Total shopping this week',
    'My spending yesterday',
    'Transport expenses last 7 days',
];

export default function SmartSearch({ onFilter, onClear }) {
    const [query, setQuery] = useState('');
    const [loading, setLoading] = useState(false);
    const [result, setResult] = useState(null);
    const inputRef = useRef(null);

    const [isFocused, setIsFocused] = useState(false);

    const handleSearch = useCallback(async (searchQuery) => {
        const q = searchQuery || query;
        if (!q.trim()) return;
        setLoading(true);
        setIsFocused(false);
        try {
            const res = await aiAPI.query(q.trim());
            setResult(res.data);
            if (onFilter && res.data.filters) {
                onFilter(res.data.filters);
            }
        } catch (err) {
            console.error('AI Search failed:', err);
            setResult({ response: "I'm sorry, I couldn't process that query right now.", error: true });
        }
        setLoading(false);
    }, [query, onFilter]);

    const handleClear = () => {
        setResult(null);
        setQuery('');
        if (onClear) onClear();
    };

    const handleKeyDown = (e) => {
        if (e.key === 'Enter') handleSearch();
        if (e.key === 'Escape') {
            handleClear();
            setIsFocused(false);
            inputRef.current?.blur();
        }
    };

    const handleSuggestion = (s) => {
        setQuery(s);
        handleSearch(s);
    };

    // Use a small delay on blur so clicks on suggestions register before the suggestions disappear
    const handleBlur = () => {
        setTimeout(() => setIsFocused(false), 200);
    };

    return (
        <div className="smart-search-premium">
            <div className="smart-search-bar-wrap">
                <div className="search-icon-box">
                    <Sparkles size={18} className="ai-icon" />
                </div>
                <input
                    ref={inputRef}
                    type="text"
                    value={query}
                    onChange={e => setQuery(e.target.value)}
                    onKeyDown={handleKeyDown}
                    onFocus={() => setIsFocused(true)}
                    onBlur={handleBlur}
                    placeholder="Ask SmartSpend AI (e.g. 'spent on food last week')"
                />
                <div className="search-actions">
                    {query && !loading && (
                        <button className="clear-btn" onClick={handleClear}>
                            <X size={16} />
                        </button>
                    )}
                    {loading ? (
                        <div className="search-loader" />
                    ) : (
                        <button className="submit-btn" onClick={() => handleSearch()} disabled={!query.trim()}>
                            <ArrowRight size={18} />
                        </button>
                    )}
                </div>
            </div>

            {!result && !loading && isFocused && (
                <div className="smart-search-suggestions absolute mt-2 z-50 left-0 right-0 p-4 rounded-xl shadow-2xl bg-[#0f1423]/95 backdrop-blur-md border border-white/10">
                    {SUGGESTIONS.map(s => (
                        <motion.button
                            key={s}
                            className="smart-search-suggestion"
                            onMouseDown={(e) => {
                                e.preventDefault(); // Keep input focus
                                handleSuggestion(s);
                            }}
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                        >
                            {s}
                        </motion.button>
                    ))}
                </div>
            )}

            <AnimatePresence>
                {result && (
                    <motion.div
                        className={`smart-search-result-premium ${result.error ? 'has-error' : ''}`}
                        initial={{ opacity: 0, y: 10, scale: 0.98 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        transition={{ duration: 0.2 }}
                    >
                        <button className="result-close" onClick={handleClear}>
                            <X size={14} />
                        </button>

                        <div className="result-header">
                            <MessageSquare size={16} className="msg-icon" />
                            <span>AI Assistant</span>
                        </div>

                        <div className="smart-search-response">
                            {result.response}
                        </div>

                        {!result.error && (
                            <>
                                <div className="smart-search-details">
                                    <div className="smart-search-detail">
                                        <div className="detail-value">{formatCurrency(result.totalSpent || 0)}</div>
                                        <div className="detail-label">Total Amount</div>
                                    </div>
                                    <div className="smart-search-detail">
                                        <div className="detail-value">{result.transactionCount || 0}</div>
                                        <div className="detail-label">Transactions</div>
                                    </div>
                                    <div className="smart-search-detail">
                                        <div className="detail-value">{formatCurrency(result.avgAmount || 0)}</div>
                                        <div className="detail-label">Average</div>
                                    </div>
                                </div>

                                {result.topCategories?.length > 0 && (
                                    <div className="smart-search-categories">
                                        {result.topCategories.map(c => {
                                            const info = CATEGORIES[c.category] || CATEGORIES.other;
                                            return (
                                                <div key={c.category} className="smart-search-cat-card">
                                                    <span className="cat-icon">{info.icon}</span>
                                                    <span className="cat-name">{info.label}</span>
                                                    <span className="cat-total">{formatCurrency(c.total)}</span>
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
                            </>
                        )}
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
