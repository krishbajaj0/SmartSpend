import multer from 'multer';
import fs from 'fs';
import Receipt from '../models/Receipt.js';
import Expense from '../models/Expense.js';
import { AppError } from '../middleware/errorHandler.js';
import { parseReceipt } from '../services/ocr/receiptParser.js';
import constants from '../config/constants.js';

// Multer config
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const dir = 'uploads/receipts';
        fs.mkdirSync(dir, { recursive: true });
        cb(null, dir);
    },
    filename: (req, file, cb) => {
        cb(null, `${Date.now()}-${file.originalname}`);
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
        const receipt = await Receipt.findOne({ _id: req.params.id, userId: req.user._id }).populate('linkedExpenseId');
        if (!receipt) throw new AppError('Receipt not found', 404);
        res.json({ success: true, receipt });
    } catch (err) { next(err); }
}

// POST /api/receipts/:id/link-expense — Create expense from receipt
export async function linkExpense(req, res, next) {
    try {
        const receipt = await Receipt.findOne({ _id: req.params.id, userId: req.user._id });
        if (!receipt) throw new AppError('Receipt not found', 404);

        const expenseData = {
            userId: req.user._id,
            amount: req.body.amount || receipt.ocrData?.amount?.value || 0,
            merchant: req.body.merchant || receipt.ocrData?.merchant?.value || 'Unknown',
            category: req.body.category || receipt.ocrData?.suggestedCategory || 'other',
            date: req.body.date || receipt.ocrData?.date?.value || new Date(),
            notes: req.body.notes || '',
            receiptUrl: receipt.fileUrl,
            receiptOcrData: receipt.ocrData?.rawText || '',
        };

        const expense = await Expense.create(expenseData);
        receipt.linkedExpenseId = expense._id;
        await receipt.save();

        res.status(201).json({ success: true, expense, receipt });
    } catch (err) { next(err); }
}
