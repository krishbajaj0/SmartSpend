import { motion } from 'framer-motion';
import {
    PieChart, Pie, Cell,
    ResponsiveContainer, Tooltip as RechartsTooltip,
} from 'recharts';
import { getCategoryInfo } from '../ui/CategoryBadge';
import './Charts.css';

const CHART_COLORS = ['#8b5cf6', '#6366f1', '#14b8a6', '#f59e0b', '#ef4444', '#3b82f6', '#ec4899'];

function CustomTooltip({ value }) {
    return (
        <div className="chart-tooltip-premium">
            <p className="chart-tooltip-value">₹{value?.toLocaleString() || 0}</p>
        </div>
    );
}

export default function CategoryDonutChart({ data }) {
    const pieChartData = data?.slice(0, 6).map((c, i) => ({
        ...c,
        color: CHART_COLORS[i % CHART_COLORS.length]
    })) || [];

    const totalSpend = pieChartData.reduce((s, c) => s + (c.value || 0), 0);

    return (
        <div className="chart-card-premium donut-card">
            <div className="chart-header-premium">
                <h3>Categories</h3>
            </div>
            <div className="chart-container-premium donut-container">
                {pieChartData.length > 0 ? (
                    <>
                        <ResponsiveContainer width="100%" height={260}>
                            <PieChart>
                                <Pie
                                    data={pieChartData}
                                    cx="50%"
                                    cy="50%"
                                    innerRadius={70}
                                    outerRadius={100}
                                    paddingAngle={3}
                                    dataKey="value"
                                    animationBegin={300}
                                    animationDuration={1200}
                                    animationEasing="ease-out"
                                >
                                    {pieChartData.map((entry) => (
                                        <Cell 
                                            key={entry.name} 
                                            fill={entry.color}
                                            style={{ 
                                                filter: 'drop-shadow(0 0 8px rgba(139, 92, 246, 0.3))',
                                                transform: 'scale(1)',
                                                transformOrigin: 'center',
                                                transition: 'all 0.3s ease',
                                            }}
                                        />
                                    ))}
                                </Pie>
                                <RechartsTooltip
                                    formatter={(value) => [`₹${value.toLocaleString()}`, '']}
                                    contentStyle={{
                                        background: 'var(--bg-card-solid)',
                                        border: '1px solid var(--border-glow)',
                                        borderRadius: 'var(--radius-md)',
                                        color: 'var(--text-primary)',
                                        boxShadow: 'var(--shadow-xl)',
                                    }}
                                />
                            </PieChart>
                        </ResponsiveContainer>
                        <motion.div 
                            className="donut-center-label"
                            initial={{ opacity: 0, scale: 0.8 }}
                            animate={{ opacity: 1, scale: 1 }}
                            transition={{ delay: 0.8, duration: 0.4 }}
                        >
                            <span className="donut-center-value">₹{totalSpend.toLocaleString()}</span>
                            <span className="donut-center-text">Total</span>
                        </motion.div>
                        <div className="donut-legend-premium">
                            {pieChartData.slice(0, 4).map((cat) => (
                                <div key={cat.name} className="donut-legend-item">
                                    <span className="donut-legend-dot" style={{ background: cat.color }} />
                                    <span className="donut-legend-label">
                                        {getCategoryInfo(cat.name).icon} {getCategoryInfo(cat.name).label}
                                    </span>
                                    <span className="donut-legend-value">₹{cat.value?.toLocaleString() || 0}</span>
                                </div>
                            ))}
                        </div>
                    </>
                ) : (
                    <div className="chart-empty">
                        <p>No category data yet</p>
                    </div>
                )}
            </div>
        </div>
    );
}
