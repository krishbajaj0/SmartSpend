import express from 'express';
import { protect } from '../middleware/auth.js';
import { scanReceipt, getReceipts, getReceipt, linkExpense, upload } from '../controllers/receiptController.js';

const router = express.Router();
router.use(protect);

router.post('/scan', upload.single('receipt'), scanReceipt);
router.get('/', getReceipts);
router.get('/:id', getReceipt);
router.post('/:id/link-expense', linkExpense);

export default router;
