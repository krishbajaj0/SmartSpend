import { NavLink, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import { LayoutDashboard, Receipt, PieChart, Target, Settings } from 'lucide-react';
import './BottomNav.css';

const navItems = [
    { path: '/dashboard', label: 'Home', icon: LayoutDashboard },
    { path: '/expenses', label: 'Expenses', icon: Receipt },
    { path: '/analytics', label: 'Analytics', icon: PieChart },
    { path: '/goals', label: 'Goals', icon: Target },
    { path: '/settings', label: 'Settings', icon: Settings },
];

export default function BottomNav() {
    const location = useLocation();

    return (
        <nav className="bottom-nav">
            {navItems.map(item => {
                const isActive = location.pathname === item.path;
                return (
                    <NavLink
                        key={item.path}
                        to={item.path}
                        className={`bottom-nav-item ${isActive ? 'active' : ''}`}
                    >
                        <div className="bottom-nav-icon-wrap">
                            <item.icon size={20} />
                            {isActive && (
                                <motion.div
                                    className="bottom-nav-indicator"
                                    layoutId="bottom-nav-active"
                                    transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                                />
                            )}
                        </div>
                        <span className="bottom-nav-label">{item.label}</span>
                    </NavLink>
                );
            })}
        </nav>
    );
}
