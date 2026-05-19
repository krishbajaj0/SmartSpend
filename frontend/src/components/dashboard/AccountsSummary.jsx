import { Wallet, Building2, CreditCard, ChevronRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import GlassCard from '../ui/GlassCard';
import { formatCurrency } from '../../utils/currency';

export default function AccountsSummary({ accounts, currency }) {
    const navigate = useNavigate();

    function getAccountIcon(type) {
        if (type === 'BANK') return <Building2 size={16} color="#3b82f6" />;
        if (type === 'CREDIT_CARD') return <CreditCard size={16} color="#f43f5e" />;
        return <Wallet size={16} color="#64748b" />;
    }

    return (
        <GlassCard className="accounts-summary-card" padding={true}>
            <div className="card-header-with-action">
                <h3 style={{ fontSize: '0.9375rem', fontWeight: '600' }}>Accounts</h3>
                <button className="view-all-btn" onClick={() => navigate('/accounts')}>
                    View All <ChevronRight size={14} />
                </button>
            </div>
            <div className="accounts-list-mini">
                {accounts.slice(0, 4).map((acc, i) => (
                    <div key={i} className="account-item-mini">
                        <div className="account-info-mini">
                            <div className="account-icon-mini">
                                {getAccountIcon(acc.type)}
                            </div>
                            <span className="account-name-mini">{acc.name}</span>
                        </div>
                        <span className={`account-balance-mini ${acc.balance < 0 ? 'negative' : ''}`}>
                            {formatCurrency(acc.balance, currency)}
                        </span>
                    </div>
                ))}
                {accounts.length === 0 && (
                    <div className="empty-mini">No accounts linked</div>
                )}
            </div>
            
            <style jsx="true">{`
                .card-header-with-action {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    margin-bottom: 12px;
                }
                .view-all-btn {
                    display: flex;
                    align-items: center;
                    gap: 4px;
                    background: none;
                    border: none;
                    color: var(--primary-light);
                    font-size: 0.8rem;
                    cursor: pointer;
                    padding: 4px 8px;
                    border-radius: 4px;
                    transition: background 0.2s;
                }
                .view-all-btn:hover {
                    background: rgba(139, 92, 246, 0.1);
                }
                .accounts-list-mini {
                    display: flex;
                    flex-direction: column;
                    gap: 8px;
                }
                .account-item-mini {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    background: rgba(255, 255, 255, 0.045);
                    padding: 8px 12px;
                    border-radius: 8px;
                    border: none;
                }
                .account-info-mini {
                    display: flex;
                    align-items: center;
                    gap: 10px;
                }
                .account-icon-mini {
                    width: 28px;
                    height: 28px;
                    border-radius: 6px;
                    background: rgba(255, 255, 255, 0.08);
                    border: 1px solid rgba(255, 255, 255, 0.1);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                }
                .account-name-mini {
                    font-size: 0.9rem;
                    color: var(--text-secondary);
                }
                .account-balance-mini {
                    font-size: 0.95rem;
                    font-weight: 600;
                    color: var(--text-primary);
                }
                .account-balance-mini.negative {
                    color: var(--danger);
                }
                .empty-mini {
                    text-align: center;
                    color: var(--text-tertiary);
                    font-size: 0.85rem;
                    padding: 10px 0;
                }
            `}</style>
        </GlassCard>
    );
}
