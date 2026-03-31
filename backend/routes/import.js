import express from 'express';
import multer from 'multer';
import csv from 'csv-parser';
import { Readable } from 'stream';
import { protect } from '../middleware/auth.js';
import Expense from '../models/Expense.js';
import { categorizeExpense } from '../services/ai/categorizer.js';

const router = express.Router();
router.use(protect);

const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 5 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
        if (file.mimetype === 'text/csv' || file.originalname.endsWith('.csv')) {
            cb(null, true);
        } else {
            cb(new Error('Only CSV files are allowed'), false);
        }
    },
});

// ── Normalize merchant from bank description ──
function normalizeMerchant(description) {
    if (!description) return 'Unknown';
    // Remove common bank prefixes
    let cleaned = description
        .replace(/^(UPI|NEFT|IMPS|POS|ATM|RTGS|TXN|REF)\s*[-/:]*\s*/i, '')
        .replace(/\d{10,}/g, '')             // Remove long numbers (reference IDs)
        .replace(/[\/\-@]+/g, ' ')           // Replace separators
        .replace(/\s+/g, ' ')               // Normalize whitespace
        .trim();
    // Take first meaningful segment (usually merchant name)
    const parts = cleaned.split(/\s{2,}|\/|\|/);
    const merchant = parts[0]?.trim() || description.trim();
    // Title case
    return merchant
        .split(' ')
        .map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
        .join(' ')
        .slice(0, 60);
}

// POST /api/import/csv
router.post('/csv', upload.single('file'), async (req, res, next) => {
    try {
        if (!req.file) {
            return res.status(400).json({ success: false, message: 'No CSV file uploaded' });
        }

        const rows = [];
        const stream = Readable.from(req.file.buffer.toString());

        await new Promise((resolve, reject) => {
            stream
                .pipe(csv({
                    mapHeaders: ({ header }) => header.trim().toLowerCase(),
                }))
                .on('data', row => rows.push(row))
                .on('end', resolve)
                .on('error', reject);
        });

        if (rows.length === 0) {
            return res.status(400).json({ success: false, message: 'CSV file is empty' });
        }

        // ── Map CSV fields (flexible header matching) ──
        const results = { imported: 0, skipped: 0, errors: 0, expenses: [] };

        for (const row of rows) {
            try {
                // Find date field
                const dateKey = Object.keys(row).find(k =>
                    /date|txn.*date|transaction.*date|posting.*date|value.*date/i.test(k));
                // Find description field
                const descKey = Object.keys(row).find(k =>
                    /description|narration|particular|remark|detail|memo/i.test(k));
                // Find amount field (debit/withdrawal or generic amount)
                const amountKey = Object.keys(row).find(k =>
                    /debit|withdrawal|amount|dr|spent/i.test(k));

                const rawDate = row[dateKey];
                const rawDesc = row[descKey];
                const rawAmount = row[amountKey];

                if (!rawDate || !rawDesc || !rawAmount) {
                    results.errors++;
                    continue;
                }

                const amount = Math.abs(parseFloat(String(rawAmount).replace(/[₹,\s]/g, '')));
                if (isNaN(amount) || amount <= 0) {
                    results.errors++;
                    continue;
                }

                // Parse date (try multiple formats)
                let parsedDate;
                const dateStr = String(rawDate).trim();
                // DD/MM/YYYY or DD-MM-YYYY
                const ddmmyyyy = dateStr.match(/(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/);
                if (ddmmyyyy) {
                    parsedDate = new Date(`${ddmmyyyy[3]}-${ddmmyyyy[2].padStart(2,'0')}-${ddmmyyyy[1].padStart(2,'0')}`);
                } else {
                    parsedDate = new Date(dateStr);
                }
                if (isNaN(parsedDate.getTime())) {
                    results.errors++;
                    continue;
                }

                const merchant = normalizeMerchant(rawDesc);
                const merchantNormalized = merchant.toLowerCase().trim();

                // ── Duplicate check ──
                const existing = await Expense.findOne({
                    userId: req.user._id,
                    merchantNormalized,
                    amount,
                    date: {
                        $gte: new Date(parsedDate.getTime() - 86400000),
                        $lte: new Date(parsedDate.getTime() + 86400000),
                    },
                });
                if (existing) {
                    results.skipped++;
                    continue;
                }

                // ── AI Categorize ──
                const aiResult = await categorizeExpense(req.user._id, merchant, rawDesc, amount);

                const expense = await Expense.create({
                    userId: req.user._id,
                    amount,
                    merchant,
                    merchantNormalized,
                    date: parsedDate,
                    category: aiResult.category,
                    notes: `Imported from CSV: ${rawDesc.slice(0, 100)}`,
                    aiCategorized: true,
                    aiConfidence: aiResult.confidence,
                    aiSuggestedCategory: aiResult.category,
                });

                results.imported++;
                results.expenses.push({
                    _id: expense._id,
                    merchant: expense.merchant,
                    amount: expense.amount,
                    category: expense.category,
                    date: expense.date,
                });
} catch {
                results.errors++;
            }
        }

        res.json({
            success: true,
            message: `Imported ${results.imported} transactions (${results.skipped} duplicates skipped, ${results.errors} errors)`,
            ...results,
        });
    } catch (err) {
        next(err);
    }
});

// POST /api/import/preview — preview parsed rows without saving
router.post('/preview', upload.single('file'), async (req, res, next) => {
    try {
        if (!req.file) {
            return res.status(400).json({ success: false, message: 'No CSV file uploaded' });
        }

        const rows = [];
        const stream = Readable.from(req.file.buffer.toString());

        await new Promise((resolve, reject) => {
            stream
                .pipe(csv({ mapHeaders: ({ header }) => header.trim().toLowerCase() }))
                .on('data', row => rows.push(row))
                .on('end', resolve)
                .on('error', reject);
        });

        const previewed = [];
        for (const row of rows.slice(0, 50)) {
            const dateKey = Object.keys(row).find(k => /date/i.test(k));
            const descKey = Object.keys(row).find(k => /description|narration|particular|remark|detail|memo/i.test(k));
            const amountKey = Object.keys(row).find(k => /debit|withdrawal|amount|dr|spent/i.test(k));

            const rawAmount = row[amountKey];
            const amount = rawAmount ? Math.abs(parseFloat(String(rawAmount).replace(/[₹,\s]/g, ''))) : 0;
            const merchant = normalizeMerchant(row[descKey]);

            if (amount > 0) {
                const aiResult = await categorizeExpense(req.user._id, merchant, row[descKey], amount);
                previewed.push({
                    date: row[dateKey],
                    description: row[descKey],
                    merchant,
                    amount,
                    category: aiResult.category,
                    confidence: aiResult.confidence,
                });
            }
        }

        res.json({ success: true, headers: Object.keys(rows[0] || {}), rows: previewed, totalRows: rows.length });
    } catch (err) {
        next(err);
    }
});

export default router;
