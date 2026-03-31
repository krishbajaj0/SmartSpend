import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Repeat, Calendar, ArrowRight } from 'lucide-react';
import GlassCard from '../ui/GlassCard';
import { aiAPI, expensesAPI } from '../../utils/api';
import { CATEGORIES } from '../ui/CategoryBadge';
import { useToast } from '../../context/ToastContext';
import './SubscriptionsCard.css';

export default function SubscriptionsCard() {
    const [subscriptions, setSubscriptions] = useState([]);
    const [loading, setLoading] = useState(true);
    const { addToast } = useToast();

    useEffect(() => {
        async function load() {
            try {
                const res = await aiAPI.getSubscriptions();
                setSubscriptions(res.data.subscriptions || []);
            } catch { /* silent */ }
            setLoading(false);
        }
        load();
    }, []);

    async function handleConvert(sub) {
        try {
            await expensesAPI.create({
                merchant: sub.merchant,
                amount: sub.amount,
                category: sub.category || 'bills',
                date: new Date().toISOString(),
                isRecurring: true,
                recurringInterval: sub.interval,
                notes: `Auto-detected ${sub.interval} subscription`,
            });
            setSubscriptions(prev =>
                prev.map(s =>
                    s.merchantNormalized === sub.merchantNormalized
                        ? { ...s, isConverted: true }
                        : s
                )
            );
            addToast(`${sub.merchant} added as recurring expense`, { type: 'success' });
        } catch {
            addToast('Failed to convert', { type: 'error' });
        }
    }

    const totalMonthly = subscriptions
        .filter(s => !s.isConverted)
        .reduce((sum, s) => {
            if (s.interval === 'monthly') return sum + s.amount;
            if (s.interval === 'weekly') return sum + s.amount * 4.33;
            if (s.interval === 'quarterly') return sum + s.amount / 3;
            if (s.interval === 'yearly') return sum + s.amount / 12;
            return sum;
        }, 0);

    if (loading || subscriptions.length === 0) return null;

    return (
        <GlassCard className="subscriptions-card" hoverable={false}>
            <div className="chart-header">
                <h3>
                    <Repeat size={16} style={{ verticalAlign: 'middle', marginRight: 6 }} />
                    Detected Subscriptions
                </h3>
            </div>

            <div className="subscriptions-list">
                {subscriptions.slice(0, 6).map((sub, i) => {
                    const cat = CATEGORIES[sub.category] || CATEGORIES.other;
                    return (
                        <motion.div
                            key={sub.merchantNormalized}
                            className="subscription-row"
                            initial={{ opacity: 0, x: -10 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: i * 0.06 }}
                        >
                            <div
                                className="subscription-icon"
                                style={{ background: `${cat.color}20` }}
                            >
                                {cat.icon}
                            </div>
                            <div className="subscription-info">
                                <div className="subscription-merchant">{sub.merchant}</div>
                                <div className="subscription-interval">
                                    <Calendar size={10} />
                                    {sub.interval} • {sub.occurrences} payments detected
                                </div>
                            </div>
                            <div className="subscription-amount">
                                ₹{sub.amount.toLocaleString('en-IN')}
                                <small>/{sub.interval === 'monthly' ? 'mo' : sub.interval === 'weekly' ? 'wk' : sub.interval === 'quarterly' ? 'qtr' : 'yr'}</small>
                            </div>
                            {sub.isConverted ? (
                                <button className="subscription-convert-btn converted">
                                    ✓ Recurring
                                </button>
                            ) : (
                                <button
                                    className="subscription-convert-btn"
                                    onClick={() => handleConvert(sub)}
                                >
                                    <ArrowRight size={10} style={{ marginRight: 2 }} />
                                    Convert
                                </button>
                            )}
                        </motion.div>
                    );
                })}
            </div>

            {totalMonthly > 0 && (
                <div className="subscriptions-total">
                    <span>Est. Monthly Total</span>
                    <span>₹{Math.round(totalMonthly).toLocaleString('en-IN')}/mo</span>
                </div>
            )}
        </GlassCard>
    );
}
