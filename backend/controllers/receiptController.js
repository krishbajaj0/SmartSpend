import { startTransactionIfSupported, commitTransactionIfSupported, abortTransactionIfSupported } from '../utils/session.js';
import multer from 'multer';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import Receipt from '../models/Receipt.js';
import Transaction from '../models/Transaction.js';
import { AppError } from '../middleware/errorHandler.js';
import { parseReceipt } from '../services/ocr/receiptParser.js';
import constants from '../config/constants.js';
import { invalidateUserDerivedCache } from '../utils/cache.js';
import { writeAuditLog } from '../utils/audit.js';
import { createExpenseTransaction, getOrCreateMigratedBalanceAccount } from '../services/transactionService.js';

// Multer config
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const dir = 'uploads/receipts';
        fs.mkdirSync(dir, { recursive: true });
        cb(null, dir);
    },
    filename: (req, file, cb) => {
        const ext = path.extname(file.originalname || '').toLowerCase();
        cb(null, `${crypto.randomUUID()}${ext}`);
    },
});

export const upload = multer({
    storage,
    limits: { fileSize: constants.upload.maxFileSize },
    fileFilter: (req, file, cb) => {
        if (constants.upload.allowedTypes.includes(file.mimetype)) {
            cb(null, true);
        } else {
            cb(new AppError('Only image files are allowed', 400), false);
        }
    },
});

// POST /api/receipts/scan
export async function scanReceipt(req, res, next) {
    try {
        if (!req.file) throw new AppError('No image uploaded', 400);

        const filePath = req.file.path;
        const fileUrl = `/uploads/receipts/${req.file.filename}`;

        // Run OCR parsing
        const ocrResult = await parseReceipt(filePath);

        const receipt = await Receipt.create({
            userId: req.user._id,
            fileName: req.file.originalname,
            fileUrl,
            fileSize: req.file.size,
            ocrData: ocrResult,
        });
        await writeAuditLog(req, {
            entityType: 'receipt',
            entityId: receipt._id,
            action: 'scan',
            after: receipt.toObject(),
        });

        res.status(201).json({ success: true, receipt });
    } catch (err) { next(err); }
}

// GET /api/receipts
export async function getReceipts(req, res, next) {
    try {
        const receipts = await Receipt.find({ userId: req.user._id }).sort({ createdAt: -1 });
        res.json({ success: true, receipts });
    } catch (err) { next(err); }
}

// GET /api/receipts/:id
export async function getReceipt(req, res, next) {
    try {
        const receipt = await Receipt.findOne({ _id: req.params.id, userId: req.user._id }).populate('linkedTransactionId');
        if (!receipt) throw new AppError('Receipt not found', 404);
        res.json({ success: true, receipt });
    } catch (err) { next(err); }
}

// GET /api/receipts/:id/file
export async function getReceiptFile(req, res, next) {
    try {
        const receipt = await Receipt.findOne({ _id: req.params.id, userId: req.user._id });
        if (!receipt) throw new AppError('Receipt not found', 404);

        const relative = receipt.fileUrl.replace(/^\/+/, '');
        const root = path.resolve(process.cwd(), 'uploads');
        const filePath = path.resolve(process.cwd(), relative);

        if (!filePath.startsWith(root + path.sep)) {
            throw new AppError('Invalid receipt path', 400);
        }

        res.setHeader('Cache-Control', 'private, no-store');
        res.sendFile(filePath);
    } catch (err) { next(err); }
}

// POST /api/receipts/:id/link-expense — Create expense from receipt
export async function linkExpense(req, res, next) {
    let session = null;
    try {
        const receipt = await Receipt.findOne({ _id: req.params.id, userId: req.user._id });
        if (!receipt) throw new AppError('Receipt not found', 404);

        session = await startTransactionIfSupported();

        const amount = req.body.amount || receipt.ocrData?.amount?.value || 0;
        let fromAccountId = req.body.fromAccountId;
        
        if (!fromAccountId) {
            fromAccountId = await getOrCreateMigratedBalanceAccount(req.user._id, session);
        }

        const idempotencyKey = `receipt_expense_${receipt._id}`;

        const expense = await createExpenseTransaction({
            userId: req.user._id,
            amount: Number(amount),
            fromAccountId,
            merchant: req.body.merchant || receipt.ocrData?.merchant?.value || 'Unknown',
            category: req.body.category || receipt.ocrData?.suggestedCategory || 'other',
            date: req.body.date || receipt.ocrData?.date?.value || new Date(),
            note: req.body.notes || '',
            idempotencyKey
        }, session);

        Object.assign(expense, {
            receiptUrl: receipt.fileUrl,
            receiptOcrData: receipt.ocrData?.rawText || '',
        });
        await expense.save({ session });

        receipt.linkedTransactionId = expense._id;
        await receipt.save({ session });
        
        await writeAuditLog(req, {
            entityType: 'receipt',
            entityId: receipt._id,
            action: 'link_expense',
            before: { linkedExpenseId: null },
            after: { linkedTransactionId: expense._id, expense: expense.toObject() },
        });

        await commitTransactionIfSupported(session);

        invalidateUserDerivedCache(req.user._id);

        res.status(201).json({ success: true, expense, receipt });
    } catch (err) { 
        if (session) {
            await abortTransactionIfSupported(session);
        }
        next(err); 
    }
}
