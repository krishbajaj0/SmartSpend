import { useState, useEffect } from 'react';
import { DollarSign, Repeat, Tag } from 'lucide-react';
import Modal from '../ui/Modal';
import Input, { Textarea } from '../ui/Input';
import Dropdown from '../ui/Dropdown';
import Button from '../ui/Button';
import { CATEGORIES } from '../ui/CategoryBadge';
import { format } from 'date-fns';
import './ExpenseFormModal.css';

const categoryOptions = Object.entries(CATEGORIES).map(([value, { label, icon }]) => ({
    value,
    label: `${icon} ${label}`,
    icon,
}));

const emptyForm = {
    amount: '',
    merchant: '',
    category: '',
    date: format(new Date(), 'yyyy-MM-dd'),
    notes: '',
    tags: '',
    isRecurring: false,
};

export default function ExpenseFormModal({ isOpen, onClose, onSubmit, expense = null }) {
    const isEditing = !!expense;
    const [form, setForm] = useState(emptyForm);
    const [errors, setErrors] = useState({});
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (isOpen) {
            if (expense) {
                setForm({
                    amount: String(expense.amount),
                    merchant: expense.merchant,
                    category: expense.category,
                    date: format(new Date(expense.date), 'yyyy-MM-dd'),
                    notes: expense.notes || '',
                    tags: (expense.tags || []).join(', '),
                    isRecurring: expense.isRecurring || false,
                });
            } else {
                setForm(emptyForm);
            }
            setErrors({});
        }
    }, [isOpen, expense]);

    function validate() {
        const errs = {};
        if (!form.amount || Number(form.amount) <= 0) errs.amount = 'Enter a valid amount';
        if (!form.merchant.trim()) errs.merchant = 'Merchant is required';
        if (!form.category) errs.category = 'Select a category';
        setErrors(errs);
        return Object.keys(errs).length === 0;
    }

    async function handleSubmit(e) {
        e.preventDefault();
        if (!validate()) return;

        setLoading(true);

        const data = {
            amount: parseFloat(form.amount),
            merchant: form.merchant.trim(),
            category: form.category,
            date: new Date(form.date).toISOString(),
            notes: form.notes.trim(),
            tags: form.tags ? form.tags.split(',').map(t => t.trim()).filter(Boolean) : [],
            isRecurring: form.isRecurring,
            receiptUrl: expense?.receiptUrl || null,
        };

        if (expense) {
            data._id = expense._id || expense.id;
        }

        try {
            await onSubmit(data);
            // Parent (handleAddOrEdit) closes the modal and refetches — no onClose() needed here
        } catch (err) {
            // Catch error and display immediately to user so they don't get stuck loading forever
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
            title={isEditing ? 'Edit Expense' : 'Add Expense'}
            size="md"
        >
            <form className="expense-form" onSubmit={handleSubmit}>
                {errors.submit && (
                    <div className="input-error" style={{ marginBottom: '16px', padding: '10px', background: 'var(--danger-bg)', borderRadius: 'var(--radius-sm)' }}>
                        {errors.submit}
                    </div>
                )}
                
                {/* Amount + Category row */}
                <div className="expense-form-row">
                    <div className="amount-input-wrapper">
                        <span className="amount-prefix">₹</span>
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
                    <Dropdown
                        label="Category"
                        options={categoryOptions}
                        value={form.category}
                        onChange={val => setField('category', val)}
                        placeholder="Select category"
                    />
                </div>
                {errors.category && (
                    <span className="input-error" style={{ marginTop: '-12px' }}>{errors.category}</span>
                )}

                {/* Merchant + Date row */}
                <div className="expense-form-row">
                    <Input
                        label="Merchant"
                        value={form.merchant}
                        onChange={e => setField('merchant', e.target.value)}
                        placeholder="e.g. Swiggy, Amazon"
                        error={errors.merchant}
                    />
                    <div className="date-input-wrapper">
                        <label>Date</label>
                        <input
                            type="date"
                            value={form.date}
                            onChange={e => setField('date', e.target.value)}
                            max={format(new Date(), 'yyyy-MM-dd')}
                        />
                    </div>
                </div>

                {/* Notes */}
                <div className="expense-form-row full">
                    <Textarea
                        label="Notes"
                        value={form.notes}
                        onChange={e => setField('notes', e.target.value)}
                        placeholder="Optional notes..."
                        rows={3}
                    />
                </div>

                {/* Tags */}
                <div className="expense-form-row full">
                    <Input
                        label="Tags"
                        value={form.tags}
                        onChange={e => setField('tags', e.target.value)}
                        placeholder="e.g. lunch, team, office"
                        icon={<Tag size={16} />}
                    />
                    <span className="tags-hint">Separate tags with commas</span>
                </div>

                {/* Recurring toggle */}
                <div className="toggle-row">
                    <span className="toggle-row-label">
                        <Repeat size={16} />
                        Recurring expense
                    </span>
                    <label className="toggle-switch">
                        <input
                            type="checkbox"
                            checked={form.isRecurring}
                            onChange={e => setField('isRecurring', e.target.checked)}
                        />
                        <span className="toggle-slider" />
                    </label>
                </div>

                {/* Actions */}
                <div className="expense-form-actions">
                    <Button variant="ghost" onClick={onClose} type="button">
                        Cancel
                    </Button>
                    <Button variant="primary" type="submit" loading={loading}>
                        {isEditing ? 'Save Changes' : 'Add Expense'}
                    </Button>
                </div>
            </form>
        </Modal>
    );
}
