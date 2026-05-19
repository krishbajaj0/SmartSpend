import { useEffect, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Upload, Image, X } from 'lucide-react';
import { format } from 'date-fns';
import GlassCard from '../components/ui/GlassCard';
import EmptyState from '../components/ui/EmptyState';
import ReceiptUploader from '../components/receipts/ReceiptUploader';
import { useToast } from '../context/ToastContext';
import { useAuth } from '../context/AuthContext';
import { receiptsAPI } from '../utils/api';
import { formatCurrency } from '../utils/currency';
import './ReceiptsPage.css';

const FALLBACK_IMAGE = 'https://images.unsplash.com/photo-1554415707-6e8cfc93fe23?w=500&auto=format&fit=crop&q=60';

export default function ReceiptsPage() {
    const [tab, setTab] = useState('upload');
    const [receipts, setReceipts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [lightbox, setLightbox] = useState(null);
    const { addToast } = useToast();
    const { user } = useAuth();
    const currency = user?.currency || 'INR';

    const loadReceipts = useCallback(async () => {
        setLoading(true);
        try {
            const res = await receiptsAPI.list();
            // Dedup array by ID just in case
            const unique = [];
            const seen = new Set();
            for (const r of (res.data.receipts || [])) {
                if (r && r._id && !seen.has(r._id)) {
                    seen.add(r._id);
                    unique.push(r);
                }
            }
            setReceipts(unique);
        } catch {
            addToast('Failed to load receipts', { type: 'error' });
        } finally {
            setLoading(false);
        }
    }, [addToast]);

    useEffect(() => {
        loadReceipts();
    }, [loadReceipts]);

    // Force refresh gallery when switching to gallery tab to avoid stale cached state
    useEffect(() => {
        if (tab === 'gallery') {
            loadReceipts();
        }
    }, [tab, loadReceipts]);

    function handleSaveExpense(expense, receipt) {
        setReceipts(prev => {
            const filtered = prev.filter(item => item._id !== receipt._id);
            return [receipt, ...filtered];
        });
        addToast(`Receipt scanned and expense saved: ${formatCurrency(expense.amount, currency)}`, { type: 'success' });
        setTab('gallery');
        loadReceipts();
    }

    function receiptImageUrl(receipt) {
        if (!receipt) return FALLBACK_IMAGE;
        return receipt.fileUrl || receiptsAPI.fileUrl(receipt._id);
    }

    function handleImageError(e) {
        e.target.src = FALLBACK_IMAGE;
    }

    return (
        <div className="receipts-page">
            <div className="receipts-page-header">
                <div style={{ display: 'flex', alignItems: 'center' }}>
                    <h1>Receipts</h1>
                    {receipts.length > 0 && (
                        <span className="receipts-count">{receipts.length} scanned</span>
                    )}
                </div>
            </div>

            <div className="receipts-tabs">
                <button
                    className={`receipts-tab ${tab === 'upload' ? 'active' : ''}`}
                    onClick={() => setTab('upload')}
                >
                    {tab === 'upload' && (
                        <motion.span className="receipts-tab-bg" layoutId="receiptsTab" />
                    )}
                    <Upload size={14} style={{ marginRight: 6, verticalAlign: 'middle' }} />
                    Upload & Scan
                </button>
                <button
                    className={`receipts-tab ${tab === 'gallery' ? 'active' : ''}`}
                    onClick={() => setTab('gallery')}
                >
                    {tab === 'gallery' && (
                        <motion.span className="receipts-tab-bg" layoutId="receiptsTab" />
                    )}
                    <Image size={14} style={{ marginRight: 6, verticalAlign: 'middle' }} />
                    Gallery
                </button>
            </div>

            {tab === 'upload' && (
                <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3 }}
                >
                    <GlassCard hoverable={false} className="receipt-upload-card">
                        <ReceiptUploader onSaveExpense={handleSaveExpense} />
                    </GlassCard>
                </motion.div>
            )}

            {tab === 'gallery' && (
                <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3 }}
                >
                    {receipts.length === 0 ? (
                        <EmptyState
                            title={loading ? 'Loading receipts' : 'No receipts yet'}
                            description={loading ? 'Fetching persisted receipts from the server.' : 'Upload and scan your first receipt to see it here.'}
                            actionLabel="Upload Receipt"
                            onAction={() => setTab('upload')}
                        />
                    ) : (
                        <div className="receipts-gallery">
                            {receipts.map((rcpt, i) => {
                                const receiptId = rcpt._id || `receipt-temp-${i}`;
                                return (
                                    <motion.div
                                        key={receiptId}
                                        className="receipt-thumb"
                                        initial={{ opacity: 0, scale: 0.9 }}
                                        animate={{ opacity: 1, scale: 1 }}
                                        transition={{ delay: i * 0.05 }}
                                        onClick={() => setLightbox(rcpt)}
                                    >
                                        <img
                                            src={receiptImageUrl(rcpt)}
                                            alt={rcpt.fileName}
                                            onError={handleImageError}
                                        />
                                        <div className="receipt-thumb-overlay">
                                            <span className="receipt-thumb-merchant">
                                                {rcpt.ocrData?.merchant?.value || rcpt.fileName}
                                            </span>
                                            <span className="receipt-thumb-amount">
                                                {formatCurrency(rcpt.ocrData?.amount?.value || 0, currency)}
                                            </span>
                                            <span className="receipt-thumb-date">
                                                {rcpt.createdAt ? format(new Date(rcpt.createdAt), 'MMM d, yyyy') : 'Just now'}
                                            </span>
                                        </div>
                                    </motion.div>
                                );
                            })}
                        </div>
                    )}
                </motion.div>
            )}

            <AnimatePresence>
                {lightbox && (
                    <motion.div
                        className="lightbox-backdrop"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={() => setLightbox(null)}
                    >
                        <motion.div
                            className="lightbox-content"
                            initial={{ scale: 0.8, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.8, opacity: 0 }}
                            transition={{ type: 'spring', damping: 25 }}
                            onClick={e => e.stopPropagation()}
                        >
                            <button
                                className="lightbox-close"
                                onClick={() => setLightbox(null)}
                                aria-label="Close"
                            >
                                <X size={20} />
                            </button>
                            <img
                                src={receiptImageUrl(lightbox)}
                                alt={lightbox.fileName}
                                className="lightbox-img"
                                onError={handleImageError}
                            />
                            <div className="lightbox-info">
                                <span>
                                    <strong>{lightbox.ocrData?.merchant?.value || lightbox.fileName}</strong>
                                </span>
                                <span>{formatCurrency(lightbox.ocrData?.amount?.value || 0, currency)}</span>
                                <span>{lightbox.createdAt ? format(new Date(lightbox.createdAt), 'MMM d, yyyy') : 'Just now'}</span>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}

