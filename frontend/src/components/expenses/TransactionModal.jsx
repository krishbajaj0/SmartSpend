import { useState, useEffect } from 'react';
import { DollarSign, Repeat, Tag, ArrowRight, ArrowDownLeft, ArrowUpRight } from 'lucide-react';
import Modal from '../ui/Modal';
import Input, { Textarea } from '../ui/Input';
import Dropdown from '../ui/Dropdown';
import Button from '../ui/Button';
import { useAuth } from '../../context/AuthContext';
import { CATEGORIES } from '../ui/CategoryBadge';
import { accountsAPI } from '../../utils/api';
import { format } from 'date-fns';
import './TransactionModal.css';

const categoryOptions = Object.entries(CATEGORIES).map(([value, { label, icon }]) => ({
    value,
    label: `${icon} ${label}`,
    icon,
}));

const emptyForm = {
    type: 'EXPENSE',
    amount: '',
    fromAccountId: '',
    toAccountId: '',
    merchant: '',
    category: '',
    date: format(new Date(), 'yyyy-MM-dd'),
    notes: '',
    tags: '',
    isRecurring: false,
    currency: 'INR',
};

export default function TransactionModal({ isOpen, onClose, onSubmit, transaction = null }) {
    const { user } = useAuth();
    const isEditing = !!transaction;
    const [form, setForm] = useState(emptyForm);
    const [errors, setErrors] = useState({});
    const [loading, setLoading] = useState(false);
    
    const [accounts, setAccounts] = useState([]);

    useEffect(() => {
        if (isOpen) {
            fetchAccounts();
            if (transaction) {
                setForm({
                    type: transaction.type || 'EXPENSE',
                    amount: String(transaction.amount),
                    fromAccountId: transaction.fromAccountId || '',
                    toAccountId: transaction.toAccountId || '',
                    merchant: transaction.merchant || transaction.note || '',
                    category: transaction.category || '',
                    date: format(new Date(transaction.date || new Date()), 'yyyy-MM-dd'),
                    notes: transaction.notes || '',
                    tags: (transaction.tags || []).join(', '),
                    isRecurring: transaction.isRecurring || false,
                    currency: transaction.currency || user?.currency || 'INR',
                });
            } else {
                setForm({ ...emptyForm, currency: user?.currency || 'INR' });
            }
            setErrors({});
        }
    }, [isOpen, transaction, user]);

    async function fetchAccounts() {
        try {
            const res = await accountsAPI.list();
            setAccounts(res.data.accounts || []);
        } catch (err) {
            console.error(err);
        }
    }

    const accountOptions = accounts.map(acc => ({
        value: acc._id,
        label: `${acc.name} (${acc.type.replace('_', ' ')})`
    }));

    function validate() {
        const errs = {};
        if (!form.amount || Number(form.amount) <= 0) errs.amount = 'Enter a valid amount';
        
        if (form.type === 'EXPENSE') {
            if (!form.fromAccountId) errs.fromAccountId = 'Select an account to pay from';
            if (!form.merchant.trim()) errs.merchant = 'Merchant is required';
            if (!form.category) errs.category = 'Select a category';
        } else if (form.type === 'INCOME') {
            if (!form.toAccountId) errs.toAccountId = 'Select an account to receive to';
            if (!form.category) errs.category = 'Select a category';
        } else if (form.type === 'TRANSFER') {
            if (!form.fromAccountId) errs.fromAccountId = 'Select source account';
            if (!form.toAccountId) errs.toAccountId = 'Select destination account';
            if (form.fromAccountId === form.toAccountId) errs.toAccountId = 'Cannot transfer to same account';
        }
        
        setErrors(errs);
        return Object.keys(errs).length === 0;
    }

    async function handleSubmit(e) {
        e.preventDefault();
        if (!validate()) return;

        setLoading(true);

        const data = {
            type: form.type,
            amount: parseFloat(form.amount),
            fromAccountId: form.fromAccountId || null,
            toAccountId: form.toAccountId || null,
            merchant: form.merchant.trim(),
            category: form.type === 'TRANSFER' ? 'Transfer' : form.category,
            currency: form.currency,
            date: new Date(form.date).toISOString(),
            notes: form.notes.trim() || form.merchant.trim(),
            tags: form.tags ? form.tags.split(',').map(t => t.trim()).filter(Boolean) : [],
            isRecurring: form.isRecurring,
        };

        if (transaction) {
            data._id = transaction._id || transaction.id;
        }

        try {
            await onSubmit(data);
        } catch (err) {
            setLoading(false);
            setErrors(prev => ({ ...prev, submit: err.response?.data?.message || err.message || 'An error occurred while saving.' }));
            return;
        }
        setLoading(false);
    }

    function setField(field, value) {
        setForm(prev => ({ ...prev, [field]: value }));
        if (errors[field]) setErrors(prev => ({ ...prev, [field]: undefined }));
    }

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title={isEditing ? 'Edit Transaction' : 'New Transaction'}
            size="md"
        >
            <form className="transaction-form" onSubmit={handleSubmit}>
                {errors.submit && (
                    <div className="input-error" style={{ marginBottom: '16px', padding: '10px', background: 'var(--danger-bg)', borderRadius: 'var(--radius-sm)' }}>
                        {errors.submit}
                    </div>
                )}
                
                {!isEditing && (
                    <div className="transaction-tabs">
                        <button 
                            type="button"
                            className={`tab-btn ${form.type === 'EXPENSE' ? 'active expense' : ''}`}
                            onClick={() => setField('type', 'EXPENSE')}
                        >
                            <ArrowUpRight size={16} /> Expense
                        </button>
                        <button 
                            type="button"
                            className={`tab-btn ${form.type === 'INCOME' ? 'active income' : ''}`}
                            onClick={() => setField('type', 'INCOME')}
                        >
                            <ArrowDownLeft size={16} /> Income
                        </button>
                        <button 
                            type="button"
                            className={`tab-btn ${form.type === 'TRANSFER' ? 'active transfer' : ''}`}
                            onClick={() => setField('type', 'TRANSFER')}
                        >
                            <ArrowRight size={16} /> Transfer
                        </button>
                    </div>
                )}

                <div className="transaction-form-row">
                    <div className="amount-input-wrapper" style={{ flex: 1 }}>
                        <Input
                            label="Amount"
                            type="number"
                            value={form.amount}
                            onChange={e => setField('amount', e.target.value)}
                            placeholder="0.00"
                            error={errors.amount}
                            min="0"
                            step="0.01"
                        />
                    </div>
                </div>

                <div className="transaction-form-row">
                    {(form.type === 'EXPENSE' || form.type === 'TRANSFER') && (
                        <div style={{ flex: 1 }}>
                            <Dropdown
                                label="From Account"
                                options={accountOptions}
                                value={form.fromAccountId}
                                onChange={val => setField('fromAccountId', val)}
                                placeholder="Select account"
                            />
                            {errors.fromAccountId && <span className="input-error">{errors.fromAccountId}</span>}
                        </div>
                    )}
                    
                    {(form.type === 'INCOME' || form.type === 'TRANSFER') && (
                        <div style={{ flex: 1 }}>
                            <Dropdown
                                label="To Account"
                                options={accountOptions}
                                value={form.toAccountId}
                                onChange={val => setField('toAccountId', val)}
                                placeholder="Select account"
                            />
                            {errors.toAccountId && <span className="input-error">{errors.toAccountId}</span>}
                        </div>
                    )}
                </div>

                {(form.type === 'EXPENSE' || form.type === 'INCOME') && (
                    <div className="transaction-form-row">
                        <div style={{ flex: 1 }}>
                            <Dropdown
                                label="Category"
                                options={categoryOptions}
                                value={form.category}
                                onChange={val => setField('category', val)}
                                placeholder="Select category"
                            />
                            {errors.category && <span className="input-error">{errors.category}</span>}
                        </div>
                    </div>
                )}

                {form.type === 'EXPENSE' && (
                    <div className="transaction-form-row">
                        <Input
                            label="Merchant"
                            value={form.merchant}
                            onChange={e => setField('merchant', e.target.value)}
                            placeholder="e.g. Swiggy, Amazon"
                            error={errors.merchant}
                        />
                    </div>
                )}

                <div className="transaction-form-row">
                    <div className="date-input-wrapper" style={{ flex: 1 }}>
                        <label>Date</label>
                        <input
                            type="date"
                            value={form.date}
                            onChange={e => setField('date', e.target.value)}
                            max={format(new Date(), 'yyyy-MM-dd')}
                        />
                    </div>
                </div>

                <div className="transaction-form-row full">
                    <Textarea
                        label="Notes"
                        value={form.notes}
                        onChange={e => setField('notes', e.target.value)}
                        placeholder="Optional notes..."
                        rows={2}
                    />
                </div>

                <div className="transaction-form-actions">
                    <Button variant="ghost" onClick={onClose} type="button">
                        Cancel
                    </Button>
                    <Button variant="primary" type="submit" loading={loading}>
                        {isEditing ? 'Save Changes' : `Add ${form.type.charAt(0) + form.type.slice(1).toLowerCase()}`}
                    </Button>
                </div>
            </form>
        </Modal>
    );
}
