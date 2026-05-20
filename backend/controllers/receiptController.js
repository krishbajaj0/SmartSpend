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
import logger from '../config/logger.js';
import { safeJson } from '../utils/response.js';

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
    let filePath = null;
    try {
        if (!req.file) throw new AppError('No image uploaded', 400);

        filePath = req.file.path;
        const fileUrl = `/uploads/receipts/${req.file.filename}`;

        // Compute hash to prevent duplicate receipt documents
        const fileBuffer = fs.readFileSync(filePath);
        const fileHash = crypto.createHash('sha256').update(fileBuffer).digest('hex');

        // Check if receipt already exists for this user with same hash
        const existingReceipt = await Receipt.findOne({ userId: req.user._id, fileHash });
        if (existingReceipt) {
            // Cleanup the duplicate file on disk
            try {
                if (fs.existsSync(filePath)) {
                    fs.unlinkSync(filePath);
                }
            } catch (err) {
                logger.error({ err, filePath }, 'Failed to delete duplicate uploaded file');
            }
            // Nullify filePath so finally block does not attempt to clean it up again
            filePath = null;

            const baseUrl = `${req.protocol}://${req.get('host')}`;
            const receiptObj = existingReceipt.toObject();
            receiptObj.fileUrl = `${baseUrl}${existingReceipt.fileUrl}`;
            return safeJson(res, 200, { success: true, receipt: receiptObj, duplicate: true });
        }

        // Run OCR parsing
        const ocrResult = await parseReceipt(filePath);

        // Check if timeout occurred or client aborted while OCR was running
        if (req.timedOut?.() || req.isAborted?.() || res.headersSent) {
            logger.warn({ filePath }, 'Scan completed but request already timed out, aborted, or headers sent.');
            return;
        }

        const receipt = await Receipt.create({
            userId: req.user._id,
            fileName: req.file.originalname,
            fileUrl,
            fileSize: req.file.size,
            fileHash,
            ocrData: ocrResult,
        });
        await writeAuditLog(req, {
            entityType: 'receipt',
            entityId: receipt._id,
            action: 'scan',
            after: receipt.toObject(),
        });

        // Fully qualified URL
        const baseUrl = `${req.protocol}://${req.get('host')}`;
        const receiptObj = receipt.toObject();
        receiptObj.fileUrl = `${baseUrl}${receipt.fileUrl}`;

        // Nullify filePath to keep the file for successful uploads
        filePath = null;

        return safeJson(res, 201, { success: true, receipt: receiptObj });
    } catch (err) {
        if (res.headersSent) {
            logger.error({ err, filePath }, 'Error caught in scanReceipt after headers were already sent.');
            return;
        }
        return next(err);
    } finally {
        if (filePath) {
            try {
                if (fs.existsSync(filePath)) {
                    fs.unlinkSync(filePath);
                }
            } catch (cleanupErr) {
                logger.error({ err: cleanupErr, filePath }, 'Failed to clean up file after scan error');
            }
        }
    }
}

// GET /api/receipts
export async function getReceipts(req, res, next) {
    try {
        const receipts = await Receipt.find({ userId: req.user._id }).sort({ createdAt: -1 });
        const baseUrl = `${req.protocol}://${req.get('host')}`;
        const normalizedReceipts = receipts.map(r => {
            const obj = r.toObject();
            if (obj.fileUrl && !obj.fileUrl.startsWith('http')) {
                obj.fileUrl = `${baseUrl}${obj.fileUrl}`;
            }
            return obj;
        });
        return safeJson(res, 200, { success: true, receipts: normalizedReceipts });
    } catch (err) {
        if (res.headersSent) {
            logger.error({ err }, 'Error caught in getReceipts after headers were already sent.');
            return;
        }
        return next(err);
    }
}

// GET /api/receipts/:id
export async function getReceipt(req, res, next) {
    try {
        const receipt = await Receipt.findOne({ _id: req.params.id, userId: req.user._id }).populate('linkedTransactionId');
        if (!receipt) throw new AppError('Receipt not found', 404);
        
        const baseUrl = `${req.protocol}://${req.get('host')}`;
        const obj = receipt.toObject();
        if (obj.fileUrl && !obj.fileUrl.startsWith('http')) {
            obj.fileUrl = `${baseUrl}${obj.fileUrl}`;
        }
        return safeJson(res, 200, { success: true, receipt: obj });
    } catch (err) {
        if (res.headersSent) {
            logger.error({ err }, 'Error caught in getReceipt after headers were already sent.');
            return;
        }
        return next(err);
    }
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

        if (res.headersSent) {
            logger.warn('getReceiptFile called but headers are already sent.');
            return;
        }

        res.setHeader('Cache-Control', 'private, no-store');
        return res.sendFile(filePath, (err) => {
            if (err) {
                if (res.headersSent) {
                    logger.error({ err }, 'Error sending file after headers were sent');
                    return;
                }
                return next(err);
            }
        });
    } catch (err) {
        if (res.headersSent) {
            logger.error({ err }, 'Error caught in getReceiptFile after headers were already sent.');
            return;
        }
        return next(err);
    }
}

// POST /api/receipts/:id/link-expense — Create expense from receipt
export async function linkExpense(req, res, next) {
    let session = null;
    try {
        const receipt = await Receipt.findOne({ _id: req.params.id, userId: req.user._id });
        if (!receipt) throw new AppError('Receipt not found', 404);

        session = await startTransactionIfSupported();

        const amount = req.body.amount || receipt.ocrData?.amount?.value || 0;
        let fromAccountId = req.body.fromAccountId || req.body.accountId;
        
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

        return safeJson(res, 201, { success: true, expense, receipt });
    } catch (err) { 
        if (session) {
            try {
                await abortTransactionIfSupported(session);
            } catch (abortErr) {
                logger.error({ err: abortErr }, 'Failed to abort transaction in linkExpense catch block');
            }
        }
        if (res.headersSent) {
            logger.error({ err }, 'Error caught in linkExpense after headers were already sent.');
            return;
        }
        return next(err); 
    }
}

