import { useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
    LayoutDashboard,
    Receipt,
    PieChart,
    Target,
    Settings,
    ChevronLeft,
    ChevronRight,
    LogOut,
    Wallet,
    Upload,
    FileSpreadsheet,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import Avatar from '../ui/Avatar';
import './Sidebar.css';

const navItems = [
    { path: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { path: '/expenses', label: 'Expenses', icon: Receipt },
    { path: '/budgets', label: 'Budgets', icon: Wallet },
    { path: '/analytics', label: 'Analytics', icon: PieChart },
    { path: '/receipts', label: 'Receipts', icon: Upload },
    { path: '/import', label: 'Import CSV', icon: FileSpreadsheet },
    { path: '/goals', label: 'Goals', icon: Target },
    { path: '/settings', label: 'Settings', icon: Settings },
];

export default function Sidebar() {
    const [collapsed, setCollapsed] = useState(false);
    const { user, logout } = useAuth();
    const location = useLocation();

    return (
        <motion.aside
            className={`sidebar ${collapsed ? 'collapsed' : ''}`}
            animate={{ width: collapsed ? 70 : 250 }}
            transition={{ duration: 0.3, ease: 'easeInOut' }}
        >
            <div className="sidebar-header">
                <AnimatePresence mode="wait">
                    {!collapsed && (
                        <motion.div
                            className="sidebar-brand"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            transition={{ duration: 0.15 }}
                        >
                            <span className="sidebar-logo">💰</span>
                            <span className="sidebar-title text-gradient">SmartSpend</span>
                        </motion.div>
                    )}
                </AnimatePresence>
                <button
                    className="sidebar-toggle"
                    onClick={() => setCollapsed(!collapsed)}
                    aria-label="Toggle sidebar"
                >
                    {collapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
                </button>
            </div>

            <nav className="sidebar-nav">
                {navItems.map(item => {
                    const isActive = location.pathname === item.path;
                    return (
                        <NavLink
                            key={item.path}
                            to={item.path}
                            className="sidebar-link"
                        >
                            {isActive && (
                                <motion.div
                                    className="sidebar-active-bg"
                                    layoutId="sidebar-active"
                                    transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                                />
                            )}
                            <span className="sidebar-link-content">
                                <item.icon size={20} className="sidebar-icon" />
                                <AnimatePresence mode="wait">
                                    {!collapsed && (
                                        <motion.span
                                            className="sidebar-label"
                                            initial={{ opacity: 0, width: 0 }}
                                            animate={{ opacity: 1, width: 'auto' }}
                                            exit={{ opacity: 0, width: 0 }}
                                            transition={{ duration: 0.15 }}
                                        >
                                            {item.label}
                                        </motion.span>
                                    )}
                                </AnimatePresence>
                            </span>
                        </NavLink>
                    );
                })}
            </nav>

            <div className="sidebar-footer">
                <div className="sidebar-user">
                    <Avatar name={user?.name} size={32} />
                    <AnimatePresence mode="wait">
                        {!collapsed && (
                            <motion.div
                                className="sidebar-user-info"
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                            >
                                <span className="sidebar-user-name">{user?.name}</span>
                                <span className="sidebar-user-email">{user?.email}</span>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>
                <button className="sidebar-logout" onClick={logout} title="Logout">
                    <LogOut size={18} />
                    <AnimatePresence mode="wait">
                        {!collapsed && (
                            <motion.span
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                            >
                                Logout
                            </motion.span>
                        )}
                    </AnimatePresence>
                </button>
            </div>
        </motion.aside>
    );
}
