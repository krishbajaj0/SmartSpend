import express from 'express';
import { protect } from '../middleware/auth.js';
import { idempotency } from '../middleware/idempotency.js';
import { createOrUpdateBudget, getBudgets, getBudgetStatus, deleteBudget } from '../controllers/budgetController.js';

const router = express.Router();
router.use(protect);
router.use(idempotency);

router.route('/').get(getBudgets).post(createOrUpdateBudget);
router.get('/status', getBudgetStatus);
router.delete('/:category', deleteBudget);

export default router;
