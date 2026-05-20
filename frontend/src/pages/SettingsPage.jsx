import { useState } from 'react';
import { motion } from 'framer-motion';
import {
    User, Camera, Globe, Sun, Moon, Bell, Download, Trash2, Shield, Save,
} from 'lucide-react';
import { format } from 'date-fns';
import GlassCard from '../components/ui/GlassCard';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';
import Dropdown from '../components/ui/Dropdown';
import Avatar from '../components/ui/Avatar';
import ConfirmDialog from '../components/ui/ConfirmDialog';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { useToast } from '../context/ToastContext';
import { expensesAPI } from '../utils/api';
import './SettingsPage.css';

const currencyOptions = [
    { value: 'INR', label: '🇮🇳 Indian Rupee (₹)' },
    { value: 'USD', label: '🇺🇸 US Dollar ($)' },
    { value: 'EUR', label: '🇪🇺 Euro (€)' },
    { value: 'GBP', label: '🇬🇧 British Pound (£)' },
    { value: 'JPY', label: '🇯🇵 Japanese Yen (¥)' },
];

export default function SettingsPage() {
    const { user, updateProfile, logout } = useAuth();
    const { theme, toggleTheme } = useTheme();
    const { addToast } = useToast();

    const [name, setName] = useState(user?.name || '');
    const [email, setEmail] = useState(user?.email || '');
    const [currency, setCurrency] = useState(user?.currency || 'INR');
    const [notifications, setNotifications] = useState({
        budgetAlerts: true,
        weeklyReport: true,
        aiInsights: true,
        email: false,
    });
    const [deleteOpen, setDeleteOpen] = useState(false);
    const [saving, setSaving] = useState(false);

    async function handleSave() {
        setSaving(true);
        try {
            await updateProfile({ name, email, currency });
            addToast('Settings saved!', { type: 'success' });
        } catch (err) {
            addToast(err.response?.data?.message || 'Failed to save settings', { type: 'error' });
        }
        setSaving(false);
    }

    async function exportData(type) {
        try {
            const res = await expensesAPI.list({ limit: 500 });
            const expenses = res.data.expenses || [];

            if (expenses.length === 0) {
                addToast('No data to export', { type: 'info' });
                return;
            }

            if (type === 'json') {
                const data = JSON.stringify(expenses, null, 2);
                const blob = new Blob([data], { type: 'application/json' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `smartexpense-data-${format(new Date(), 'yyyy-MM-dd')}.json`;
                a.click();
                URL.revokeObjectURL(url);
                addToast('Data exported as JSON!', { type: 'success' });
            } else {
                const rows = [['Date', 'Merchant', 'Category', 'Amount']];
                expenses.forEach(e => {
                    rows.push([e.date ? format(new Date(e.date), 'yyyy-MM-dd') : '', e.merchant || '', e.category || '', e.amount || 0]);
                });
                const csv = rows.map(r => r.join(',')).join('\n');
                const blob = new Blob([csv], { type: 'text/csv' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `smartexpense-data-${format(new Date(), 'yyyy-MM-dd')}.csv`;
                a.click();
                URL.revokeObjectURL(url);
                addToast('Data exported as CSV!', { type: 'success' });
            }
        } catch {
            addToast('Failed to export data', { type: 'error' });
        }
    }

    function handleDeleteAccount() {
        setDeleteOpen(false);
        logout();
        addToast('Account logged out. Full deletion available via API.', { type: 'info' });
    }

    function toggleNotif(key) {
        setNotifications(prev => ({ ...prev, [key]: !prev[key] }));
    }

    return (
        <div className="settings-page">
            <div className="settings-page-header">
                <h1>Settings</h1>
            </div>

            <div className="settings-sections">
                {/* ── Profile ── */}
                <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
                    <GlassCard hoverable={false}>
                        <div className="settings-section-title">
                            <User size={18} /> Profile
                        </div>
                        <div className="settings-profile-row">
                            <div className="settings-avatar-upload">
                                <Avatar name={name} src={user?.avatar} size={80} />
                                <div className="settings-avatar-overlay">
                                    <Camera size={20} />
                                </div>
                                <input type="file" accept="image/*" className="settings-avatar-input" />
                            </div>
                            <div className="settings-profile-fields">
                                <Input
                                    label="Name"
                                    value={name}
                                    onChange={e => setName(e.target.value)}
                                />
                                <Input
                                    label="Email"
                                    value={email}
                                    onChange={e => setEmail(e.target.value)}
                                    type="email"
                                />
                                <div style={{ marginTop: '0.75rem', display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                                    <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Connected Providers:</span>
                                    {user?.providers?.includes('google') && (
                                        <span style={{
                                            display: 'inline-flex',
                                            alignItems: 'center',
                                            gap: '6px',
                                            background: 'rgba(66, 133, 244, 0.12)',
                                            border: '1px solid rgba(66, 133, 244, 0.25)',
                                            color: '#8ab4f8',
                                            padding: '4px 10px',
                                            borderRadius: '12px',
                                            fontSize: '0.75rem',
                                            fontWeight: 600
                                        }}>
                                            <svg viewBox="0 0 24 24" width="12" height="12" fill="currentColor" style={{ marginRight: '2px' }}><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" fill="#EA4335"/></svg>
                                            Google OAuth
                                        </span>
                                    )}
                                    {(!user?.providers || user.providers.includes('local')) && (
                                        <span style={{
                                            display: 'inline-flex',
                                            alignItems: 'center',
                                            gap: '6px',
                                            background: 'rgba(255, 255, 255, 0.05)',
                                            border: '1px solid rgba(255, 255, 255, 0.1)',
                                            color: 'var(--text-secondary)',
                                            padding: '4px 10px',
                                            borderRadius: '12px',
                                            fontSize: '0.75rem',
                                            fontWeight: 600
                                        }}>
                                            ✉️ Password Login
                                        </span>
                                    )}
                                </div>
                            </div>
                        </div>
                    </GlassCard>
                </motion.div>

                {/* ── Preferences ── */}
                <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.08 }}>
                    <GlassCard hoverable={false}>
                        <div className="settings-section-title">
                            <Globe size={18} /> Preferences
                        </div>

                        <div className="setting-row">
                            <div className="setting-row-info">
                                <span className="setting-row-label">Currency</span>
                                <span className="setting-row-desc">Applied to all amounts</span>
                            </div>
                            <div className="currency-select">
                                <Dropdown
                                    options={currencyOptions}
                                    value={currency}
                                    onChange={setCurrency}
                                />
                            </div>
                        </div>

                        <div className="setting-row">
                            <div className="setting-row-info">
                                <span className="setting-row-label">Theme</span>
                                <span className="setting-row-desc">
                                    {theme === 'dark' ? 'Dark mode' : 'Light mode'}
                                </span>
                            </div>
                            <Button
                                variant="ghost"
                                size="sm"
                                icon={theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
                                onClick={toggleTheme}
                            >
                                {theme === 'dark' ? 'Light Mode' : 'Dark Mode'}
                            </Button>
                        </div>
                    </GlassCard>
                </motion.div>

                {/* ── Notifications ── */}
                <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.16 }}>
                    <GlassCard hoverable={false}>
                        <div className="settings-section-title">
                            <Bell size={18} /> Notifications
                        </div>

                        {[
                            { key: 'budgetAlerts', label: 'Budget Alerts', desc: 'Get notified when budgets near limits' },
                            { key: 'weeklyReport', label: 'Weekly Report', desc: 'Receive a weekly spending summary' },
                            { key: 'aiInsights', label: 'AI Insights', desc: 'Personalized spending insights and tips' },
                            { key: 'email', label: 'Email Notifications', desc: 'Receive alerts via email' },
                        ].map(item => (
                            <div key={item.key} className="setting-row">
                                <div className="setting-row-info">
                                    <span className="setting-row-label">{item.label}</span>
                                    <span className="setting-row-desc">{item.desc}</span>
                                </div>
                                <label className="toggle-switch">
                                    <input
                                        type="checkbox"
                                        checked={notifications[item.key]}
                                        onChange={() => toggleNotif(item.key)}
                                    />
                                    <span className="toggle-slider" />
                                </label>
                            </div>
                        ))}
                    </GlassCard>
                </motion.div>

                {/* ── Data Export ── */}
                <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.24 }}>
                    <GlassCard hoverable={false}>
                        <div className="settings-section-title">
                            <Download size={18} /> Export Data
                        </div>
                        <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: 'var(--space-md)' }}>
                            Download all your expense data for backup or analysis.
                        </p>
                        <div style={{ display: 'flex', gap: 'var(--space-md)' }}>
                            <Button variant="secondary" size="sm" onClick={() => exportData('json')}>
                                Export JSON
                            </Button>
                            <Button variant="secondary" size="sm" onClick={() => exportData('csv')}>
                                Export CSV
                            </Button>
                        </div>
                    </GlassCard>
                </motion.div>

                {/* ── Danger Zone ── */}
                <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.32 }}>
                    <div className="settings-danger-zone">
                        <div className="settings-section-title">
                            <Shield size={18} /> Danger Zone
                        </div>
                        <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                            Permanently delete your account and all data. This cannot be undone.
                        </p>
                        <div className="danger-actions">
                            <Button variant="danger" size="sm" icon={<Trash2 size={14} />} onClick={() => setDeleteOpen(true)}>
                                Delete Account
                            </Button>
                        </div>
                    </div>
                </motion.div>

                {/* Save */}
                <div className="settings-save-bar">
                    <Button variant="primary" icon={<Save size={16} />} onClick={handleSave} loading={saving}>
                        Save Changes
                    </Button>
                </div>
            </div>

            <ConfirmDialog
                isOpen={deleteOpen}
                onClose={() => setDeleteOpen(false)}
                onConfirm={handleDeleteAccount}
                title="Delete Account"
                message="Are you sure you want to delete your account? All your data will be permanently removed."
                confirmLabel="Delete Forever"
            />
        </div>
    );
}
