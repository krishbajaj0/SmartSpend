import express from 'express';
import { protect } from '../middleware/auth.js';
import * as accountController from '../controllers/accountController.js';

const router = express.Router();

router.use(protect);

router.get('/', accountController.getAccounts);
router.post('/', accountController.createAccount);
router.put('/:id', accountController.updateAccount);
router.delete('/:id', accountController.deleteAccount);
router.get('/:id/transactions', accountController.getAccountTransactions);

export default router;
