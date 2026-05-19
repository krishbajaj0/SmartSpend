import express from 'express';
import { protect } from '../middleware/auth.js';
import * as transactionController from '../controllers/transactionController.js';

const router = express.Router();

router.use(protect);

router.get('/', transactionController.getTransactions);
router.post('/expense', transactionController.createExpense);
router.post('/income', transactionController.createIncome);
router.post('/transfer', transactionController.createTransfer);

export default router;
