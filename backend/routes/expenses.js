import express from 'express';
import { protect } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import {
    createExpense, getExpenses, getExpense,
    updateExpense, deleteExpense, bulkDelete,
    getRecurringExpenses, duplicateExpense,
} from '../controllers/expenseController.js';

const router = express.Router();

router.use(protect);

const expenseValidation = {
    amount: { required: true, type: 'number', min: 0.01 },
    merchant: { required: true, type: 'string', minLength: 1 },
    category: {
        required: true, type: 'string',
        enum: ['food', 'transport', 'shopping', 'bills', 'entertainment', 'health', 'education', 'groceries', 'other'],
    },
};

router.route('/')
    .get(getExpenses)
    .post(validate(expenseValidation), createExpense);

router.get('/recurring', getRecurringExpenses);
router.post('/bulk-delete', bulkDelete);
router.post('/duplicate/:id', duplicateExpense);

router.route('/:id')
    .get(getExpense)
    .put(updateExpense)
    .delete(deleteExpense);

export default router;
