import express from 'express';
import multer from 'multer';
import csv from 'csv-parser';
import crypto from 'crypto';
import { Readable } from 'stream';
import { protect } from '../middleware/auth.js';
import { idempotency } from '../middleware/idempotency.js';
import Transaction from '../models/Transaction.js';
import ImportBatch from '../models/ImportBatch.js';
import { categorizeExpense } from '../services/ai/categorizer.js';
import { invalidateUserDerivedCache } from '../utils/cache.js';
import { writeAuditLog } from '../utils/audit.js';

const router = express.Router();
router.use(protect);

const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 5 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
        if (file.mimetype === 'text/csv' || file.originalname.toLowerCase().endsWith('.csv')) {
            cb(null, true);
        } else {
            cb(new Error('Only CSV files are allowed'), false);
        }
    },
});

function normalizeMerchant(description) {
    if (!description) return 'Unknown';
    const cleaned = description
        .replace(/^(UPI|NEFT|IMPS|POS|ATM|RTGS|TXN|REF)\s*[-/:]*\s*/i, '')
        .replace(/\d{10,}/g, '')
        .replace(/[\/\-@]+/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
    const merchant = cleaned.split(/\s{2,}|\/|\|/)[0]?.trim() || description.trim();
    return merchant
        .split(' ')
        .map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
        .join(' ')
        .slice(0, 60);
}

function parseMoney(value) {
    if (value === undefined || value === null || value === '') return null;
    const normalized = String(value)
        .replace(/[₹$€£,\s]/g, '')
        .replace(/^\((.*)\)$/, '-$1')
        .trim();
    const parsed = Number(normalized);
    return Number.isFinite(parsed) ? parsed : null;
}

function parseDateValue(value) {
    const dateStr = String(value || '').trim();
    const ddmmyyyy = dateStr.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
    const parsed = ddmmyyyy
        ? new Date(`${ddmmyyyy[3]}-${ddmmyyyy[2].padStart(2, '0')}-${ddmmyyyy[1].padStart(2, '0')}T00:00:00.000Z`)
        : new Date(dateStr);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function sourceHash(row) {
    return crypto.createHash('sha256').update(JSON.stringify(row)).digest('hex');
}

function findKey(row, regex) {
    return Object.keys(row).find(k => regex.test(k));
}

function parseExpenseRow(row) {
    const dateKey = findKey(row, /date|txn.*date|transaction.*date|posting.*date|value.*date/i);
    const descKey = findKey(row, /description|narration|particular|remark|detail|memo/i);
    const debitKey = findKey(row, /^debit$|withdrawal|debit amount|dr$|spent/i);
    const creditKey = findKey(row, /^credit$|deposit|credit amount|cr$|received/i);
    const amountKey = findKey(row, /^amount$|transaction amount|txn amount/i);
    const typeKey = findKey(row, /type|drcr|transaction type/i);

    const parsedDate = parseDateValue(row[dateKey]);
    const description = String(row[descKey] || '').trim();
    if (!parsedDate || !description) {
        return { status: 'error', reason: 'Missing valid date or description' };
    }

    const debit = parseMoney(row[debitKey]);
    const credit = parseMoney(row[creditKey]);
    const genericAmount = parseMoney(row[amountKey]);
    const type = String(row[typeKey] || '').toLowerCase();

    let amount = null;
    let status = 'ready';
    let reason = null;

    if (debit !== null && debit > 0 && (!credit || credit === 0)) {
        amount = debit;
    } else if (credit !== null && credit > 0 && (!debit || debit === 0)) {
        status = 'skipped';
        reason = 'Credit/income row';
    } else if (debit !== null && credit !== null && debit > 0 && credit > 0) {
        status = 'ambiguous';
        reason = 'Both debit and credit are populated';
    } else if (genericAmount !== null) {
        if (genericAmount < 0) {
            amount = -genericAmount;
        } else if (/debit|dr|withdrawal|spent/.test(type)) {
            amount = genericAmount;
        } else if (/credit|cr|deposit|received/.test(type)) {
            status = 'skipped';
            reason = 'Credit/income row';
        } else {
            status = 'ambiguous';
            reason = 'Generic positive amount without debit/credit direction';
        }
    } else {
        status = 'error';
        reason = 'Missing amount';
    }

    if (status !== 'ready') return { status, reason };
    if (!Number.isFinite(amount) || amount <= 0) {
        return { status: 'error', reason: 'Invalid debit amount' };
    }

    const merchant = normalizeMerchant(description);
    return {
        status,
        date: parsedDate,
        description,
        merchant,
        merchantNormalized: merchant.toLowerCase().trim(),
        amount,
        sourceHash: sourceHash(row),
        sourceRow: row,
    };
}

async function parseCsvFile(file) {
    if (!file) throw new Error('No CSV file uploaded');
    const rows = [];
    const stream = Readable.from(file.buffer.toString('utf8'));

    await new Promise((resolve, reject) => {
        stream
            .pipe(csv({ mapHeaders: ({ header }) => header.trim().toLowerCase() }))
            .on('data', row => rows.push(row))
            .on('end', resolve)
            .on('error', reject);
    });

    return rows;
}

router.post('/csv', upload.single('file'), idempotency, async (req, res, next) => {
    try {
        if (!req.file) return res.status(400).json({ success: false, message: 'No CSV file uploaded' });

        const rows = await parseCsvFile(req.file);
        if (rows.length === 0) return res.status(400).json({ success: false, message: 'CSV file is empty' });

        const fileHash = crypto.createHash('sha256').update(req.file.buffer).digest('hex');
        const batch = await ImportBatch.create({
            userId: req.user._id,
            status: 'previewed',
            fileName: req.file.originalname,
            fileHash,
            totalRows: rows.length,
            requestId: req.requestId,
        });

        const parsed = rows.map(parseExpenseRow);
        const ready = parsed.filter(r => r.status === 'ready');
        const ambiguousRows = parsed.filter(r => r.status === 'ambiguous').length;
        const errorRows = parsed.filter(r => r.status === 'error').length;
        const skippedRows = parsed.filter(r => r.status === 'skipped').length;

        const existingHashes = new Set((await Transaction.find({
            type: 'EXPENSE',
            userId: req.user._id,
            sourceHash: { $in: ready.map(r => r.sourceHash) },
        }, { sourceHash: 1 }).lean()).map(e => e.sourceHash));

        const seen = new Set();
        const candidates = [];
        let duplicateRows = 0;
        for (const row of ready) {
            const localKey = row.sourceHash;
            if (seen.has(localKey) || existingHashes.has(localKey)) {
                duplicateRows++;
                continue;
            }
            seen.add(localKey);
            const aiResult = await categorizeExpense(req.user._id, row.merchant, row.description, row.amount);
            candidates.push({
                userId: req.user._id,
                amount: row.amount,
                baseAmount: row.amount,
                merchant: row.merchant,
                merchantNormalized: row.merchantNormalized,
                date: row.date,
                category: aiResult.category,
                notes: `Imported from CSV: ${row.description.slice(0, 100)}`,
                aiCategorized: true,
                aiConfidence: aiResult.confidence,
                importBatchId: batch._id,
                sourceHash: row.sourceHash,
                sourceRow: row.sourceRow,
            });
        }

        let inserted = [];
        if (candidates.length > 0) {
            inserted = await Transaction.insertMany(candidates.map(c => ({ ...c, type: 'EXPENSE' })), { ordered: false });
        }

        batch.status = 'committed';
        batch.importedRows = inserted.length;
        batch.skippedRows = skippedRows;
        batch.errorRows = errorRows;
        batch.duplicateRows = duplicateRows;
        batch.ambiguousRows = ambiguousRows;
        batch.committedAt = new Date();
        await batch.save();

        await writeAuditLog(req, {
            entityType: 'import_batch',
            entityId: batch._id,
            action: 'commit',
            after: batch.toObject(),
        });
        invalidateUserDerivedCache(req.user._id);

        res.json({
            success: true,
            batchId: batch._id,
            message: `Imported ${inserted.length} transactions (${duplicateRows} duplicates, ${ambiguousRows} ambiguous, ${errorRows} errors)`,
            imported: inserted.length,
            skipped: skippedRows,
            duplicates: duplicateRows,
            ambiguous: ambiguousRows,
            errors: errorRows,
            expenses: inserted.map(expense => ({
                _id: expense._id,
                merchant: expense.merchant,
                amount: expense.amount,
                category: expense.category,
                date: expense.date,
            })),
        });
    } catch (err) {
        next(err);
    }
});

router.post('/preview', upload.single('file'), idempotency, async (req, res, next) => {
    try {
        if (!req.file) return res.status(400).json({ success: false, message: 'No CSV file uploaded' });
        const rows = await parseCsvFile(req.file);
        const previewed = rows.slice(0, 50).map(row => {
            const parsed = parseExpenseRow(row);
            return {
                status: parsed.status,
                reason: parsed.reason,
                date: parsed.date,
                description: parsed.description,
                merchant: parsed.merchant,
                amount: parsed.amount,
            };
        });

        res.json({ success: true, headers: Object.keys(rows[0] || {}), rows: previewed, totalRows: rows.length });
    } catch (err) {
        next(err);
    }
});

export default router;
