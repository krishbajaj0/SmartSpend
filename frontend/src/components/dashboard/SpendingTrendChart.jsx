import { motion } from 'framer-motion';
import {
    AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip,
    ResponsiveContainer,
} from 'recharts';
import { formatCurrency, formatCurrencyCompact } from '../../utils/currency';
import './Charts.css';

function CustomTooltip({ active, payload, label, currency }) {
    if (!active || !payload?.length) return null;
    return (
        <motion.div 
            className="chart-tooltip-premium"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2 }}
        >
            <p className="chart-tooltip-label">{label}</p>
            <p className="chart-tooltip-value">{formatCurrency(payload[0].value, currency)}</p>
        </motion.div>
    );
}

export default function SpendingTrendChart({ data, trendDays, onTrendDaysChange, currency = 'INR' }) {
    return (
        <div className="chart-card-premium">
            <div className="chart-header-premium">
                <h3>Spending Trend</h3>
                <div className="chart-toggles">
                    {[7, 30, 90].map(d => (
                        <button
                            key={d}
                            className={`chart-toggle ${trendDays === d ? 'active' : ''}`}
                            onClick={() => onTrendDaysChange(d)}
                        >
                            {d}d
                        </button>
                    ))}
                </div>
            </div>
            <div className="chart-container-premium">
                {data && data.length > 0 ? (
                    <ResponsiveContainer width="100%" height={220}>
                        <AreaChart data={data} margin={{ top: 20, right: 20, left: -20, bottom: 0 }}>
                            <defs>
                                <linearGradient id="areaGradPremium" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="0%" stopColor="#8b5cf6" stopOpacity={0.2} />
                                    <stop offset="50%" stopColor="#8b5cf6" stopOpacity={0.05} />
                                    <stop offset="100%" stopColor="#8b5cf6" stopOpacity={0} />
                                </linearGradient>
                            </defs>

                            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" vertical={false} />
                            <XAxis 
                                dataKey="label" 
                                stroke="var(--text-tertiary)" 
                                fontSize={12} 
                                tickLine={false} 
                                axisLine={false}
                                dy={10}
                            />
                            <YAxis 
                                stroke="var(--text-tertiary)" 
                                fontSize={12} 
                                tickLine={false} 
                                axisLine={false}
                                tickFormatter={v => formatCurrencyCompact(v, currency)}
                                dx={-10}
                            />
                            <RechartsTooltip content={<CustomTooltip currency={currency} />} />
                            <Area 
                                type="monotone" 
                                dataKey="amount" 
                                stroke="#8b5cf6" 
                                strokeWidth={2} 
                                fillOpacity={1} 
                                fill="url(#areaGradPremium)" 
                                animationDuration={1500}
                            />
                        </AreaChart>
                    </ResponsiveContainer>
                ) : (
                    <div className="chart-empty" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '8px', height: '220px' }}>
                        <span style={{ fontSize: '24px' }}>📈</span>
                        <h4 style={{ fontSize: '0.875rem', fontWeight: '600', color: 'var(--text-primary)', margin: 0 }}>No spending trends yet</h4>
                        <span style={{ fontSize: '0.78rem', color: 'var(--text-tertiary)', maxWidth: '240px', textAlign: 'center', lineHeight: '1.4' }}>
                            Your primary spending graph will populate once transactions are recorded.
                        </span>
                    </div>
                )}
            </div>
        </div>
    );
}
