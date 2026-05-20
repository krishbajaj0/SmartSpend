import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { format } from 'date-fns';
import { Plus, Bell, Sun, Moon } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { useToast } from '../../context/ToastContext';
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
    const { user, socket } = useAuth();
    const { theme, toggleTheme } = useTheme();
    const { addToast } = useToast();
    const navigate = useNavigate();
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

    useEffect(() => {
        if (!socket) return;
        
        const handleNewNotification = (notification) => {
            setUnreadCount(prev => prev + 1);
            addToast(`Alert: ${notification.title}`, { type: 'info' });
        };

        socket.on('notification', handleNewNotification);

        return () => {
            socket.off('notification', handleNewNotification);
        };
    }, [socket, addToast]);

    return (
        <header className="app-header">
            <div className="header-left flex items-center" style={{ gap: '24px' }}>
                <h2 className="header-greeting mb-0" style={{ transform: 'translateY(1px)' }}>
                    {getGreeting()}, <span className="text-gradient">{user?.name?.split(' ')[0]}</span> 👋
                </h2>
                <span className="text-sm text-gray-500 font-medium border-l border-white/10 pl-6" style={{ transform: 'translateY(1px)' }}>
                    {format(new Date(), 'EEEE, MMMM d, yyyy')}
                </span>
                <span className="header-ai-insight" style={{ fontSize: '0.8125rem', color: 'rgba(255, 255, 255, 0.55)', fontWeight: '500', paddingLeft: '24px', borderLeft: '1px solid rgba(255, 255, 255, 0.05)', display: 'flex', alignItems: 'center', gap: '6px', transform: 'translateY(1px)', opacity: 0.72 }}>
                    <span style={{ fontSize: '14px', opacity: 0.7 }}>✨</span> You spent 18% less than yesterday.
                </span>
                <div style={{ background: 'rgba(20, 184, 166, 0.04)', border: '1px solid rgba(20, 184, 166, 0.15)', fontSize: '0.65rem', color: 'rgba(20, 184, 166, 0.8)', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.05em', height: '22px', display: 'flex', alignItems: 'center', gap: '6px', padding: '0 8px', borderRadius: '12px', transform: 'translateY(1px)' }}>
                    <span className="live-pulse-dot" />
                    <span>Live Syncing</span>
                </div>
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

                <Avatar name={user?.name} src={user?.avatar} size={36} online />
            </div>
        </header>
    );
}
