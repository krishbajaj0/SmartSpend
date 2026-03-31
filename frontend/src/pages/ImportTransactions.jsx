import { useState, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Upload, FileSpreadsheet, CheckCircle, X, Eye } from 'lucide-react';
import GlassCard from '../components/ui/GlassCard';
import Button from '../components/ui/Button';
import { useToast } from '../context/ToastContext';
import { importAPI } from '../utils/api';
import { CATEGORIES } from '../components/ui/CategoryBadge';
import './ImportTransactions.css';

export default function ImportTransactions() {
    const navigate = useNavigate();
    const [file, setFile] = useState(null);
    const [dragover, setDragover] = useState(false);
    const [previewing, setPreviewing] = useState(false);
    const [importing, setImporting] = useState(false);
    const [previewData, setPreviewData] = useState(null);
    const [result, setResult] = useState(null);
    const fileRef = useRef();
    const { addToast } = useToast();

    const handleDrop = useCallback((e) => {
        e.preventDefault();
        setDragover(false);
        const droppedFile = e.dataTransfer?.files?.[0];
        if (droppedFile && (droppedFile.name.endsWith('.csv') || droppedFile.type === 'text/csv')) {
            setFile(droppedFile);
            setResult(null);
            setPreviewData(null);
        } else {
            addToast('Please upload a CSV file', { type: 'error' });
        }
    }, [addToast]);

    const handleFileSelect = (e) => {
        const selected = e.target.files?.[0];
        if (selected) {
            setFile(selected);
            setResult(null);
            setPreviewData(null);
        }
    };

    const handlePreview = async () => {
        if (!file) return;
        setPreviewing(true);
        try {
            const formData = new FormData();
            formData.append('file', file);
            const res = await importAPI.preview(formData);
            setPreviewData(res.data);
        } catch (err) {
            addToast(err.response?.data?.message || 'Failed to parse CSV', { type: 'error' });
        }
        setPreviewing(false);
    };

    const handleImport = async () => {
        if (!file) return;
        setImporting(true);
        try {
            const formData = new FormData();
            formData.append('file', file);
            const res = await importAPI.upload(formData);
            setResult(res.data);
            setPreviewData(null);
            addToast(res.data.message || 'Transactions imported successfully!', { type: 'success' });
        } catch (err) {
            addToast(err.response?.data?.message || 'Import failed', { type: 'error' });
        }
        setImporting(false);
    };

    const clearFile = () => {
        setFile(null);
        setPreviewData(null);
        setResult(null);
        if (fileRef.current) fileRef.current.value = '';
    };

    return (
        <div className="import-page">
            <div className="import-page-header">
                <h1>Import Transactions</h1>
            </div>

            {/* ── Drop Zone ── */}
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
                <GlassCard hoverable={false}>
                    <div
                        className={`import-dropzone ${dragover ? 'dragover' : ''}`}
                        onDragOver={(e) => { e.preventDefault(); setDragover(true); }}
                        onDragLeave={() => setDragover(false)}
                        onDrop={handleDrop}
                        onClick={() => fileRef.current?.click()}
                    >
                        <div className="dropzone-icon">
                            <Upload size={48} />
                        </div>
                        <div className="dropzone-text">
                            <p>Drag & drop your bank statement CSV here</p>
                            <p>or <strong>click to browse</strong></p>
                            <p style={{ fontSize: '0.8rem', opacity: 0.5, marginTop: '8px' }}>
                                Supports various bank formats (SBI, HDFC, ICICI, Axis, etc.)
                            </p>
                        </div>
                        <input
                            ref={fileRef}
                            type="file"
                            accept=".csv"
                            onChange={handleFileSelect}
                            style={{ display: 'none' }}
                        />

                        {file && (
                            <div className="dropzone-file-info">
                                <FileSpreadsheet size={16} />
                                {file.name} ({(file.size / 1024).toFixed(1)} KB)
                                <button onClick={(e) => { e.stopPropagation(); clearFile(); }}>
                                    <X size={14} />
                                </button>
                            </div>
                        )}
                    </div>

                    {file && !result && (
                        <div className="import-actions">
                            <Button
                                variant="secondary"
                                icon={<Eye size={16} />}
                                onClick={handlePreview}
                                loading={previewing}
                            >
                                Preview
                            </Button>
                            <Button
                                variant="primary"
                                icon={<Upload size={16} />}
                                onClick={handleImport}
                                loading={importing}
                            >
                                Import Transactions
                            </Button>
                        </div>
                    )}
                </GlassCard>
            </motion.div>

            {/* ── Preview Table ── */}
            <AnimatePresence>
                {previewData && (
                    <motion.div
                        className="import-preview"
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0 }}
                    >
                        <h3>
                            <Eye size={18} /> Preview ({previewData.rows?.length || 0} of {previewData.totalRows} rows)
                        </h3>
                        <div className="import-preview-stats">
                            <span>Total rows: <strong>{previewData.totalRows}</strong></span>
                            <span>Parsable: <strong>{previewData.rows?.length || 0}</strong></span>
                            <span>Headers: <strong>{previewData.headers?.join(', ')}</strong></span>
                        </div>
                        <div className="import-table-wrapper">
                            <table className="import-table">
                                <thead>
                                    <tr>
                                        <th>#</th>
                                        <th>Date</th>
                                        <th>Merchant</th>
                                        <th>Amount</th>
                                        <th>Category</th>
                                        <th>Confidence</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {(previewData.rows || []).map((row, i) => {
                                        const cat = CATEGORIES[row.category] || CATEGORIES.other;
                                        return (
                                            <motion.tr
                                                key={i}
                                                initial={{ opacity: 0, x: -10 }}
                                                animate={{ opacity: 1, x: 0 }}
                                                transition={{ delay: i * 0.02 }}
                                            >
                                                <td>{i + 1}</td>
                                                <td>{row.date}</td>
                                                <td>{row.merchant}</td>
                                                <td style={{ fontWeight: 600 }}>₹{row.amount.toLocaleString('en-IN')}</td>
                                                <td>{cat.icon} {cat.label}</td>
                                                <td className={row.confidence > 0.6 ? 'confidence-high' : 'confidence-low'}>
                                                    {row.confidence > 0.6 ? '✅' : '⚠️'} {Math.round(row.confidence * 100)}%
                                                </td>
                                            </motion.tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* ── Loading ── */}
            {importing && (
                <div className="loading-overlay">
                    <div className="loading-spinner" />
                    <p>Importing and categorizing transactions...</p>
                </div>
            )}

            {/* ── Result ── */}
            <AnimatePresence>
                {result && (
                    <motion.div
                        className="import-result"
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                    >
                        <h3><CheckCircle size={22} style={{ verticalAlign: 'middle', marginRight: 6 }} /> Import Complete</h3>
                        <p>{result.message}</p>
                        <div className="import-result-stats">
                            <div className="import-result-stat">
                                <div className="stat-number">{result.imported}</div>
                                <div className="stat-label">Imported</div>
                            </div>
                            <div className="import-result-stat">
                                <div className="stat-number">{result.skipped}</div>
                                <div className="stat-label">Duplicates</div>
                            </div>
                            <div className="import-result-stat">
                                <div className="stat-number">{result.errors}</div>
                                <div className="stat-label">Errors</div>
                            </div>
                        </div>
                        <div style={{ marginTop: 'var(--space-lg)' }}>
                            <Button variant="primary" onClick={() => navigate('/expenses')}>
                                View Expenses
                            </Button>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
