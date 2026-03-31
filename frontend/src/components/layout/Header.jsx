import { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Plus, Bell, Sun, Moon } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { notificationsAPI } from '../../utils/api';
import Avatar from '../ui/Avatar';
import Button from '../ui/Button';
import './Header.css';

function getGreeting() {
    const h = new Date().getHours();
    if (h < 12) return 'Good morning';
    if (h < 17) return 'Good afternoon';
    return 'Good evening';
}

export default function Header() {
    const { user } = useAuth();
    const { theme, toggleTheme } = useTheme();
    const navigate = useNavigate();
    const location = useLocation();
    const [unreadCount, setUnreadCount] = useState(0);

    useEffect(() => {
        async function fetchNotifications() {
            try {
                const res = await notificationsAPI.list({ unread: true });
                const notifications = res.data.notifications || res.data || [];
                setUnreadCount(Array.isArray(notifications) ? notifications.filter(n => !n.read).length : 0);
            } catch {
                setUnreadCount(0);
            }
        }
        fetchNotifications();
    }, []);

    return (
        <header className="app-header">
            <div className="header-left">
                <h2 className="header-greeting">
                    {getGreeting()}, <span className="text-gradient">{user?.name?.split(' ')[0]}</span> 👋
                </h2>
            </div>
            <div className="header-right">
                <button
                    className="header-icon-btn"
                    aria-label="Notifications"
                    onClick={() => navigate('/settings')}
                >
                    <Bell size={20} />
                    {unreadCount > 0 && (
                        <motion.span
                            className="header-badge"
                            initial={{ scale: 0 }}
                            animate={{ scale: 1 }}
                            transition={{ type: 'spring', stiffness: 500, damping: 15 }}
                        >
                            {unreadCount}
                        </motion.span>
                    )}
                </button>

                <motion.button
                    className="header-icon-btn"
                    onClick={toggleTheme}
                    aria-label="Toggle theme"
                    whileTap={{ rotate: 180 }}
                    transition={{ duration: 0.3 }}
                >
                    {theme === 'dark' ? <Sun size={20} /> : <Moon size={20} />}
                </motion.button>

                <Avatar name={user?.name} size={36} online />
            </div>
        </header>
    );
}
