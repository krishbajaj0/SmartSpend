import { useState, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Upload, Loader, CheckCircle, AlertTriangle, X, Save } from 'lucide-react';
import Button from '../ui/Button';
import Dropdown from '../ui/Dropdown';
import { CATEGORIES } from '../ui/CategoryBadge';
import { scanReceipt } from '../../utils/mockOcr';
import './ReceiptUploader.css';

const categoryOptions = Object.entries(CATEGORIES).map(([value, { label, icon }]) => ({
    value,
    label: `${icon} ${label}`,
}));

function ConfidenceBadge({ confidence }) {
    const isHigh = confidence >= 0.8;
    return (
        <span className={`confidence-badge ${isHigh ? 'high' : 'low'}`}>
            {isHigh ? <CheckCircle size={11} /> : <AlertTriangle size={11} />}
            {Math.round(confidence * 100)}%
        </span>
    );
}

export default function ReceiptUploader({ onSaveExpense }) {
    const [dragOver, setDragOver] = useState(false);
    const [file, setFile] = useState(null);
    const [previewUrl, setPreviewUrl] = useState(null);
    const [scanning, setScanning] = useState(false);
    const [ocrResult, setOcrResult] = useState(null);
    const [editedData, setEditedData] = useState({});
    const inputRef = useRef(null);

    const handleFile = useCallback(async (f) => {
        if (!f || !f.type.startsWith('image/')) return;
        setFile(f);
        setPreviewUrl(URL.createObjectURL(f));
        setOcrResult(null);
        setScanning(true);

        try {
            const result = await scanReceipt(f);
            setOcrResult(result);
            setEditedData({
                amount: String(result.amount.value),
                date: result.date.value,
                merchant: result.merchant.value,
                category: result.suggestedCategory,
            });
        } catch {
            // error handled silently for mock
        } finally {
            setScanning(false);
        }
    }, []);

    const handleDrop = useCallback((e) => {
        e.preventDefault();
        setDragOver(false);
        const f = e.dataTransfer.files[0];
        handleFile(f);
    }, [handleFile]);

    function handleDragOver(e) {
        e.preventDefault();
        setDragOver(true);
    }

    function handleDragLeave() {
        setDragOver(false);
    }

    function handleBrowse(e) {
        const f = e.target.files[0];
        if (f) handleFile(f);
    }

    function reset() {
        setFile(null);
        setPreviewUrl(null);
        setOcrResult(null);
        setEditedData({});
        setScanning(false);
        if (inputRef.current) inputRef.current.value = '';
    }

    function handleSave() {
        if (!ocrResult) return;
        const expense = {
            amount: parseFloat(editedData.amount),
            merchant: editedData.merchant,
            category: editedData.category,
            date: new Date(editedData.date).toISOString(),
            notes: '',
            tags: [],
            isRecurring: false,
            receiptUrl: previewUrl,
        };
        onSaveExpense(expense, file, ocrResult);
        reset();
    }

    return (
        <div className="receipt-uploader">
            {/* Upload zone — shown when no file selected */}
            {!file && (
                <motion.div
                    className={`receipt-upload-zone ${dragOver ? 'drag-over' : ''}`}
                    onDrop={handleDrop}
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onClick={() => inputRef.current?.click()}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                >
                    <Upload size={48} className="upload-icon" />
                    <p className="upload-text">
                        Drag & drop your receipt here or <strong>browse</strong>
                    </p>
                    <p className="upload-hint">Supports JPG, PNG, WEBP — Max 5MB</p>
                    <input
                        ref={inputRef}
                        type="file"
                        accept="image/*"
                        onChange={handleBrowse}
                        className="upload-input"
                    />
                </motion.div>
            )}

            {/* Preview + scanning */}
            {file && !ocrResult && (
                <motion.div
                    className="receipt-preview-container"
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                >
                    <img src={previewUrl} alt="Receipt preview" className="receipt-preview-img" />
                    {scanning && (
                        <motion.div
                            className="scan-overlay"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                        >
                            <div className="scan-line" />
                            <span className="scan-text">
                                <Loader size={16} className="animate-spin" />
                                Scanning receipt...
                            </span>
                        </motion.div>
                    )}
                </motion.div>
            )}

            {/* OCR Result review */}
            <AnimatePresence>
                {ocrResult && (
                    <motion.div
                        className="ocr-result"
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                    >
                        <div className="ocr-result-header">
                            <h3>📋 Extracted Data</h3>
                            <Button variant="ghost" size="sm" icon={<X size={14} />} onClick={reset}>
                                Cancel
                            </Button>
                        </div>

                        <div className="ocr-fields">
                            {/* Amount */}
                            <motion.div
                                className="ocr-field"
                                initial={{ opacity: 0, x: -20 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{ delay: 0.1 }}
                            >
                                <div className="ocr-field-info">
                                    <span className="ocr-field-label">Amount</span>
                                    <input
                                        type="number"
                                        className="ocr-field-input"
                                        value={editedData.amount}
                                        onChange={e => setEditedData(p => ({ ...p, amount: e.target.value }))}
                                        step="0.01"
                                    />
                                </div>
                                <ConfidenceBadge confidence={ocrResult.amount.confidence} />
                            </motion.div>

                            {/* Merchant */}
                            <motion.div
                                className="ocr-field"
                                initial={{ opacity: 0, x: -20 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{ delay: 0.2 }}
                            >
                                <div className="ocr-field-info">
                                    <span className="ocr-field-label">Merchant</span>
                                    <input
                                        type="text"
                                        className="ocr-field-input"
                                        value={editedData.merchant}
                                        onChange={e => setEditedData(p => ({ ...p, merchant: e.target.value }))}
                                    />
                                </div>
                                <ConfidenceBadge confidence={ocrResult.merchant.confidence} />
                            </motion.div>

                            {/* Date */}
                            <motion.div
                                className="ocr-field"
                                initial={{ opacity: 0, x: -20 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{ delay: 0.3 }}
                            >
                                <div className="ocr-field-info">
                                    <span className="ocr-field-label">Date</span>
                                    <input
                                        type="date"
                                        className="ocr-field-input"
                                        value={editedData.date}
                                        onChange={e => setEditedData(p => ({ ...p, date: e.target.value }))}
                                    />
                                </div>
                                <ConfidenceBadge confidence={ocrResult.date.confidence} />
                            </motion.div>

                            {/* Category */}
                            <motion.div
                                className="ocr-field"
                                initial={{ opacity: 0, x: -20 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{ delay: 0.4 }}
                            >
                                <div className="ocr-field-info">
                                    <span className="ocr-field-label">Suggested Category</span>
                                    <Dropdown
                                        options={categoryOptions}
                                        value={editedData.category}
                                        onChange={val => setEditedData(p => ({ ...p, category: val }))}
                                    />
                                </div>
                            </motion.div>
                        </div>

                        {/* Line items */}
                        {ocrResult.lineItems?.length > 0 && (
                            <motion.div
                                className="ocr-line-items"
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                transition={{ delay: 0.5 }}
                            >
                                <h4>Line Items</h4>
                                {ocrResult.lineItems.map((item, i) => (
                                    <div key={i} className="ocr-line-item">
                                        <span>{item.name}</span>
                                        <span className="ocr-line-item-amount">₹{item.amount.toLocaleString('en-IN')}</span>
                                    </div>
                                ))}
                            </motion.div>
                        )}

                        {/* Raw OCR text */}
                        <details>
                            <summary style={{ cursor: 'pointer', fontSize: '0.8rem', color: 'var(--text-tertiary)' }}>
                                View raw OCR text
                            </summary>
                            <div className="ocr-raw-text">{ocrResult.rawText}</div>
                        </details>

                        {/* Actions */}
                        <div className="ocr-actions">
                            <Button variant="ghost" onClick={reset} fullWidth>Cancel</Button>
                            <Button variant="primary" icon={<Save size={16} />} onClick={handleSave} fullWidth>
                                Save as Expense
                            </Button>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
