import { motion } from 'framer-motion';
import { format } from 'date-fns';
import { Plus, Receipt, FileText } from 'lucide-react';
import './DashboardHeader.css';

const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
        opacity: 1,
        transition: { staggerChildren: 0.08 }
    }
};

const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.4, ease: [0.25, 0.46, 0.45, 0.94] } }
};

function QuickActions() {
    const actions = [
        { icon: Plus, label: 'Add Expense', color: '#8b5cf6', path: '/expenses?action=add' },
        { icon: Receipt, label: 'Scan Receipt', color: '#14b8a6', path: '/receipts' },
        { icon: FileText, label: 'Generate Report', color: '#6366f1', path: '/analytics' },
    ];

    return (
        <div className="quick-actions">
            {actions.map((a, i) => {
                const IconComponent = a.icon;
                return (
                    <motion.button
                        key={a.label}
                        className="quick-action-btn"
                        variants={itemVariants}
                        initial="hidden"
                        animate="visible"
                        transition={{ delay: 0.3 + i * 0.1 }}
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        onClick={() => window.location.href = a.path}
                    >
                        <div className="quick-action-icon" style={{ background: `${a.color}20`, color: a.color }}>
                            <IconComponent size={18} />
                        </div>
                        <span>{a.label}</span>
                    </motion.button>
                );
            })}
        </div>
    );
}

export default function DashboardHeader({ greetingData }) {
    return (
        <motion.div 
            className="dashboard-hero-premium"
            variants={containerVariants}
            initial="hidden"
            animate="visible"
        >
            <div className="hero-content">
                <motion.h1 
                    className="dashboard-hero-title"
                    variants={itemVariants}
                >
                    {greetingData.greeting.split(' ')[0]} <span className="text-gradient">{greetingData.greeting.split(' ')[1]}</span> 👋
                </motion.h1>
                <motion.p 
                    className="dashboard-hero-subtitle"
                    variants={itemVariants}
                >
                    {format(new Date(), 'EEEE, MMMM d, yyyy')}
                </motion.p>
                {greetingData.insight && (
                    <motion.p 
                        className="dashboard-hero-insight"
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.3 }}
                    >
                        {greetingData.insight}
                    </motion.p>
                )}
            </div>
            <QuickActions />
        </motion.div>
    );
}
