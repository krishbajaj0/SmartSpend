import { motion } from 'framer-motion';
import {
    AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip,
    ResponsiveContainer,
} from 'recharts';
import './Charts.css';

function CustomTooltip({ active, payload, label }) {
    if (!active || !payload?.length) return null;
    return (
        <motion.div 
            className="chart-tooltip-premium"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2 }}
        >
            <p className="chart-tooltip-label">{label}</p>
            <p className="chart-tooltip-value">₹{payload[0].value.toLocaleString()}</p>
        </motion.div>
    );
}

export default function SpendingTrendChart({ data, trendDays, onTrendDaysChange }) {
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
                    <ResponsiveContainer width="100%" height={320}>
                        <AreaChart data={data} margin={{ top: 20, right: 20, left: -20, bottom: 0 }}>
                            <defs>
                                <linearGradient id="areaGradPremium" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="0%" stopColor="#8b5cf6" stopOpacity={0.4} />
                                    <stop offset="50%" stopColor="#8b5cf6" stopOpacity={0.15} />
                                    <stop offset="100%" stopColor="#8b5cf6" stopOpacity={0} />
                                </linearGradient>
                                <filter id="chartGlow" x="-50%" y="-50%" width="200%" height="200%">
                                    <feGaussianBlur stdDeviation="3" result="coloredBlur" />
                                    <feMerge>
                                        <feMergeNode in="coloredBlur" />
                                        <feMergeNode in="SourceGraphic" />
                                    </feMerge>
                                </filter>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
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
                                tickFormatter={v => `₹${(v / 1000).toFixed(0)}k`}
                                dx={-10}
                            />
                            <RechartsTooltip content={<CustomTooltip />} />
                            <Area 
                                type="monotone" 
                                dataKey="amount" 
                                stroke="#8b5cf6" 
                                strokeWidth={3} 
                                fillOpacity={1} 
                                fill="url(#areaGradPremium)" 
                                animationDuration={1500}
                                filter="url(#chartGlow)"
                            />
                        </AreaChart>
                    </ResponsiveContainer>
                ) : (
                    <div className="chart-empty">
                        <p>No spending data for this period</p>
                    </div>
                )}
            </div>
        </div>
    );
}
