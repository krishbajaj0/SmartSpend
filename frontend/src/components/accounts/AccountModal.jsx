import { useState, useEffect } from 'react';
import { Wallet, Building2, CreditCard } from 'lucide-react';
import Modal from '../ui/Modal';
import Input from '../ui/Input';
import Dropdown from '../ui/Dropdown';
import Button from '../ui/Button';
import './AccountModal.css';

const typeOptions = [
    { value: 'WALLET', label: 'Cash Wallet', icon: <Wallet size={16} /> },
    { value: 'BANK', label: 'Bank Account', icon: <Building2 size={16} /> },
    { value: 'CREDIT_CARD', label: 'Credit Card', icon: <CreditCard size={16} /> },
];

const emptyForm = {
    name: '',
    type: 'WALLET',
    balance: '',
    currency: 'INR',
    creditLimit: '',
    bankName: '',
    accountNumber: '',
};

export default function AccountModal({ isOpen, onClose, onSubmit, account = null }) {
    const [form, setForm] = useState(emptyForm);
    const [errors, setErrors] = useState({});
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (isOpen) {
            if (account) {
                setForm({
                    ...emptyForm,
                    ...account,
                    balance: Math.abs(account.balance), // Show as positive for display
                    creditLimit: account.creditLimit || '',
                });
            } else {
                setForm(emptyForm);
            }
            setErrors({});
        }
    }, [isOpen, account]);

    function validate() {
        const errs = {};
        if (!form.name?.trim()) errs.name = 'Name is required';
        if (form.balance === '') errs.balance = 'Balance is required';
        
        if (form.type === 'BANK') {
            if (!form.bankName?.trim()) errs.bankName = 'Bank name is required';
        }
        
        if (form.type === 'CREDIT_CARD') {
            if (form.creditLimit === '' || Number(form.creditLimit) <= 0) {
                errs.creditLimit = 'Valid credit limit is required';
            }
        }
        
        setErrors(errs);
        return Object.keys(errs).length === 0;
    }

    async function handleSubmit(e) {
        e.preventDefault();
        if (!validate()) return;

        setLoading(true);
        try {
            const data = {
                ...form,
                balance: parseFloat(form.balance),
                creditLimit: form.type === 'CREDIT_CARD' ? parseFloat(form.creditLimit) : 0,
            };
            await onSubmit(data);
            onClose();
        } catch (err) {
            setErrors({ submit: err.response?.data?.message || 'Failed to save account' });
        } finally {
            setLoading(false);
        }
    }

    function setField(field, value) {
        setForm(prev => ({ ...prev, [field]: value }));
        if (errors[field]) setErrors(prev => ({ ...prev, [field]: undefined }));
    }

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title={account ? 'Edit Account' : 'Add New Account'}
            size="md"
        >
            <form className="add-account-form" onSubmit={handleSubmit}>
                {errors.submit && <div className="submit-error">{errors.submit}</div>}

                <div className="form-section">
                    <Dropdown
                        label="Account Type"
                        options={typeOptions}
                        value={form.type}
                        onChange={val => setField('type', val)}
                        className={account ? 'disabled' : ''}
                    />
                </div>

                <div className="form-row">
                    <Input
                        label="Account Name"
                        placeholder="e.g. Daily Expenses, HDFC Savings"
                        value={form.name}
                        onChange={e => setField('name', e.target.value)}
                        error={errors.name}
                    />
                </div>

                <div className="form-row">
                    <Input
                        label={form.type === 'CREDIT_CARD' ? 'Outstanding Balance' : 'Current Balance'}
                        type="number"
                        placeholder="0.00"
                        value={form.balance}
                        onChange={e => setField('balance', e.target.value)}
                        error={errors.balance}
                        step="0.01"
                    />
                </div>

                {form.type === 'CREDIT_CARD' && (
                    <div className="form-row">
                        <Input
                            label="Credit Limit"
                            type="number"
                            placeholder="50000"
                            value={form.creditLimit}
                            onChange={e => setField('creditLimit', e.target.value)}
                            error={errors.creditLimit}
                        />
                    </div>
                )}

                {form.type === 'BANK' && (
                    <>
                        <div className="form-row">
                            <Input
                                label="Bank Name"
                                placeholder="e.g. HDFC, ICICI"
                                value={form.bankName}
                                onChange={e => setField('bankName', e.target.value)}
                                error={errors.bankName}
                            />
                        </div>
                        <div className="form-row">
                            <Input
                                label="Account Number (Last 4 digits)"
                                placeholder="1234"
                                value={form.accountNumber}
                                onChange={e => setField('accountNumber', e.target.value)}
                                maxLength={4}
                            />
                        </div>
                    </>
                )}

                <div className="add-account-actions">
                    <Button variant="ghost" onClick={onClose} type="button">Cancel</Button>
                    <Button variant="primary" type="submit" loading={loading}>
                        {account ? 'Update Account' : 'Create Account'}
                    </Button>
                </div>
            </form>
        </Modal>
    );
}
