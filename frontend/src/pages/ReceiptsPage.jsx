import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Upload, Image, X } from 'lucide-react';
import { format } from 'date-fns';
import GlassCard from '../components/ui/GlassCard';
import EmptyState from '../components/ui/EmptyState';
import ReceiptUploader from '../components/receipts/ReceiptUploader';
import { useToast } from '../context/ToastContext';
import { expensesAPI } from '../utils/api';
import { createReceiptEntry } from '../utils/mockOcr';
import './ReceiptsPage.css';

export default function ReceiptsPage() {
    const [tab, setTab] = useState('upload'); // 'upload' | 'gallery'
    const [receipts, setReceipts] = useState([]);
    const [lightbox, setLightbox] = useState(null);
    const { addToast } = useToast();

    async function handleSaveExpense(expenseData, file, ocrResult) {
        // Save to gallery locally
        const entry = createReceiptEntry(file, ocrResult);
        entry.expense = expenseData;
        setReceipts(prev => [entry, ...prev]);

        // Also persist to backend
        try {
            await expensesAPI.create(expenseData);
            addToast(`Receipt scanned & expense saved — ₹${expenseData.amount.toLocaleString('en-IN')}`, { type: 'success' });
        } catch {
            addToast(`Receipt scanned locally but failed to save expense to server.`, { type: 'warning' });
        }
        setTab('gallery');
    }

    return (
        <div className="receipts-page">
            {/* Header */}
            <div className="receipts-page-header">
                <div style={{ display: 'flex', alignItems: 'center' }}>
                    <h1>Receipts</h1>
                    {receipts.length > 0 && (
                        <span className="receipts-count">{receipts.length} scanned</span>
                    )}
                </div>
            </div>

            {/* Tabs */}
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

            {/* Upload tab */}
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

            {/* Gallery tab */}
            {tab === 'gallery' && (
                <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3 }}
                >
                    {receipts.length === 0 ? (
                        <EmptyState
                            title="No receipts yet"
                            description="Upload and scan your first receipt to see it here."
                            actionLabel="Upload Receipt"
                            onAction={() => setTab('upload')}
                        />
                    ) : (
                        <div className="receipts-gallery">
                            {receipts.map((rcpt, i) => (
                                <motion.div
                                    key={rcpt.id}
                                    className="receipt-thumb"
                                    initial={{ opacity: 0, scale: 0.9 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                    transition={{ delay: i * 0.05 }}
                                    onClick={() => setLightbox(rcpt)}
                                >
                                    <img src={rcpt.fileUrl} alt={rcpt.fileName} />
                                    <div className="receipt-thumb-overlay">
                                        <span className="receipt-thumb-merchant">
                                            {rcpt.ocrData?.merchant?.value || rcpt.fileName}
                                        </span>
                                        <span className="receipt-thumb-amount">
                                            ₹{rcpt.ocrData?.amount?.value?.toLocaleString('en-IN') || '—'}
                                        </span>
                                        <span className="receipt-thumb-date">
                                            {format(new Date(rcpt.uploadedAt), 'MMM d, yyyy')}
                                        </span>
                                    </div>
                                </motion.div>
                            ))}
                        </div>
                    )}
                </motion.div>
            )}

            {/* Lightbox */}
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
                                src={lightbox.fileUrl}
                                alt={lightbox.fileName}
                                className="lightbox-img"
                            />
                            <div className="lightbox-info">
                                <span>
                                    <strong>{lightbox.ocrData?.merchant?.value}</strong>
                                </span>
                                <span>₹{lightbox.ocrData?.amount?.value?.toLocaleString('en-IN')}</span>
                                <span>{format(new Date(lightbox.uploadedAt), 'MMM d, yyyy')}</span>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
