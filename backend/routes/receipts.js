import express from 'express';
import { protect } from '../middleware/auth.js';
import { idempotency } from '../middleware/idempotency.js';
import { scanReceipt, getReceipts, getReceipt, getReceiptFile, linkExpense, upload } from '../controllers/receiptController.js';

const router = express.Router();
router.use(protect);

router.post('/scan', upload.single('receipt'), idempotency, scanReceipt);
router.get('/', getReceipts);
router.get('/:id/file', getReceiptFile);
router.get('/:id', getReceipt);
router.post('/:id/link-expense', idempotency, linkExpense);

export default router;
