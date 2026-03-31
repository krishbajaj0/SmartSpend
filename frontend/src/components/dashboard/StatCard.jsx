import { useMemo } from 'react';
import { motion } from 'framer-motion';
import { ArrowUpRight, ArrowDownRight } from 'lucide-react';
import AnimatedCounter from '../ui/AnimatedCounter';
import './DashboardCards.css';

const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.4, ease: [0.25, 0.46, 0.45, 0.94] } }
};

function SparklineMini({ data, color = '#8b5cf6' }) {
    const path = useMemo(() => {
        if (!data?.length || data.length < 2) return '';
        const max = Math.max(...data);
        const min = Math.min(...data);
        const range = max - min || 1;
        const width = 60;
        const height = 24;
        
        const points = data.map((val) => {
            const x = (data.indexOf(val) / (data.length - 1)) * width;
            const y = height - ((val - min) / range) * height;
            return `${x},${y}`;
        });
        
        return `M${points.join(' L')}`;
    }, [data]);

    if (!path) return null;

    return (
        <svg viewBox="0 0 60 24" className="sparkline-mini">
            <defs>
                <linearGradient id={`sparkGradMini-${color}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={color} stopOpacity="0.4" />
                    <stop offset="100%" stopColor={color} stopOpacity="0" />
                </linearGradient>
            </defs>
            <motion.path
                d={path}
                fill="none"
                stroke={color}
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                initial={{ pathLength: 0 }}
                animate={{ pathLength: 1 }}
                transition={{ duration: 1.5, ease: "easeOut" }}
            />
        </svg>
    );
}

export default function StatCard({ 
    label, 
    value, 
    prefix = '', 
    icon: Icon, 
    color, 
    change, 
    changeType, 
    delay = 0, 
    sparklineData 
}) {
    const isPositive = changeType === 'up';
    const isNegative = changeType === 'down';
    const IconComponent = Icon;
    
    return (
        <motion.div
            variants={itemVariants}
            initial="hidden"
            animate="visible"
            transition={{ delay, duration: 0.5 }}
            className="stat-card-premium"
            style={{ '--card-color': color }}
            whileHover={{ y: -6, transition: { duration: 0.2 } }}
        >
            <div className="stat-card-glow" style={{ background: `radial-gradient(600px circle at 50% 0%, ${color}20, transparent 40%)` }} />
            <div className="stat-card-accent" style={{ background: `linear-gradient(90deg, ${color}00, ${color}40, ${color}00)` }} />
            <div className="stat-card-header-premium">
                <span className="stat-card-label-premium">{label}</span>
                <div className="stat-card-icon-premium" style={{ 
                    background: `${color}15`,
                    border: `1px solid ${color}30`
                }}>
                    <IconComponent size={20} style={{ color }} />
                </div>
            </div>
            <div className="stat-card-value-premium">
                <span className="stat-card-prefix">{prefix}</span>
                <AnimatedCounter value={value} duration={1500} />
            </div>
            <div className="stat-card-footer">
                <div className={`stat-card-change-premium ${changeType}`}>
                    {isPositive && <ArrowUpRight size={14} />}
                    {isNegative && <ArrowDownRight size={14} />}
                    <span>{change}</span>
                </div>
                {sparklineData && sparklineData.length > 0 && (
                    <div className="stat-card-sparkline">
                        <SparklineMini data={sparklineData} color={color} />
                    </div>
                )}
            </div>
        </motion.div>
    );
}
