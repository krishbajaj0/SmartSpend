import { useState, useEffect, useCallback } from 'react';
import { Plus, Wallet, Building2, CreditCard, Trash2, Edit2 } from 'lucide-react';
import GlassCard from '../components/ui/GlassCard';
import Button from '../components/ui/Button';
import AccountModal from '../components/accounts/AccountModal';
import { accountsAPI } from '../utils/api';
import { formatCurrency } from '../utils/currency';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import './AccountsPage.css';

export default function AccountsPage() {
    const { user, loading: authLoading } = useAuth();
    const currency = user?.currency || 'INR';
    const { addToast } = useToast();
    
    const [accounts, setAccounts] = useState([]);
    const [netWorth, setNetWorth] = useState(0);
    const [loading, setLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingAccount, setEditingAccount] = useState(null);

    const fetchAccounts = useCallback(async () => {
        try {
            setLoading(true);
            const res = await accountsAPI.list();
            setAccounts(res.data.accounts);
            setNetWorth(res.data.netWorth);
        } catch {
            addToast('Failed to load accounts', { type: 'error' });
        } finally {
            setLoading(false);
        }
    }, [addToast]);

    useEffect(() => {
        if (!authLoading) fetchAccounts();
    }, [authLoading, fetchAccounts]);

    useEffect(() => {
        const handler = () => fetchAccounts();
        window.addEventListener('expenseUpdated', handler);
        return () => window.removeEventListener('expenseUpdated', handler);
    }, [fetchAccounts]);

    async function handleAddAccount(data) {
        await accountsAPI.create(data);
        fetchAccounts();
        addToast('Account created successfully!', { type: 'success' });
        window.dispatchEvent(new Event('expenseUpdated'));
    }

    async function handleUpdateAccount(data) {
        await accountsAPI.update(data._id, data);
        fetchAccounts();
        addToast('Account updated!', { type: 'success' });
        window.dispatchEvent(new Event('expenseUpdated'));
    }

    async function handleDeleteAccount(id) {
        if (!window.confirm('Are you sure you want to delete this account? This will hide the account but preserve transaction history.')) return;
        try {
            await accountsAPI.delete(id);
            fetchAccounts();
            addToast('Account deleted', { type: 'success' });
            window.dispatchEvent(new Event('expenseUpdated'));
        } catch {
            addToast('Failed to delete account', { type: 'error' });
        }
    }

    function openAdd() {
        setEditingAccount(null);
        setIsModalOpen(true);
    }

    function openEdit(account) {
        setEditingAccount(account);
        setIsModalOpen(true);
    }

    function getAccountIcon(type) {
        if (type === 'BANK') return <Building2 size={24} color="#3b82f6" />;
        if (type === 'CREDIT_CARD') return <CreditCard size={24} color="#f43f5e" />;
        return <Wallet size={24} color="#64748b" />;
    }

    function getUtilizationColor(pct) {
        if (pct < 30) return '#10b981'; // Green
        if (pct <= 70) return '#f59e0b'; // Yellow/Warning
        return '#ef4444'; // Red
    }

    if (authLoading || loading) {
        return (
            <div className="accounts-page loading">
                <div className="loading-spinner" />
            </div>
        );
    }

    return (
        <div className="accounts-page">
            <div className="accounts-header">
                <div>
                    <h1>Accounts & Net Worth</h1>
                    <div className="net-worth-display">
                        Net Worth: <span className={netWorth >= 0 ? 'positive' : 'negative'}>{formatCurrency(netWorth, currency)}</span>
                    </div>
                </div>
                <Button variant="primary" icon={<Plus size={18} />} onClick={openAdd}>
                    Add Account
                </Button>
            </div>

            <div className="accounts-grid">
                {accounts.map(acc => (
                    <GlassCard key={acc._id} className="account-card">
                        <div className="account-card-header">
                            <div className="account-icon-wrapper">
                                {getAccountIcon(acc.type)}
                            </div>
                            <div className="account-card-title">
                                <h3>{acc.name}</h3>
                                <span className="account-type-badge">{acc.type.replace('_', ' ')}</span>
                            </div>
                            <div className="account-card-actions">
                                <button className="account-action-btn edit" onClick={() => openEdit(acc)}>
                                    <Edit2 size={16} />
                                </button>
                                <button className="account-action-btn delete" onClick={() => handleDeleteAccount(acc._id)}>
                                    <Trash2 size={16} />
                                </button>
                            </div>
                        </div>

                        <div className="account-card-balance">
                            {formatCurrency(acc.balance, acc.currency || currency)}
                        </div>

                        {acc.type === 'CREDIT_CARD' && acc.creditLimit > 0 && (
                            <div className="credit-utilization-wrapper">
                                <div className="credit-utilization-info">
                                    <span>Credit Usage: {acc.utilization}%</span>
                                    <span>Limit: {formatCurrency(acc.creditLimit, acc.currency || currency)}</span>
                                </div>
                                <div className="credit-utilization-bar-bg">
                                    <div 
                                        className="credit-utilization-bar-fill" 
                                        style={{ 
                                            width: `${acc.utilization}%`,
                                            backgroundColor: getUtilizationColor(acc.utilization)
                                        }} 
                                    />
                                </div>
                            </div>
                        )}

                        {acc.type === 'BANK' && acc.accountNumber && (
                            <div className="bank-details">
                                <span>{acc.bankName}</span>
                                <span>•••{acc.accountNumber.slice(-4)}</span>
                            </div>
                        )}
                    </GlassCard>
                ))}
            </div>

            <AccountModal 
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                onSubmit={editingAccount ? handleUpdateAccount : handleAddAccount}
                account={editingAccount}
            />
        </div>
    );
}
