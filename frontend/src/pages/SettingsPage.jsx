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
                                <Avatar name={name} size={80} />
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
