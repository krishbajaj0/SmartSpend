import express from 'express';
import { protect } from '../middleware/auth.js';
import { getNotifications, markRead, markAllRead } from '../controllers/notificationController.js';

const router = express.Router();
router.use(protect);

router.get('/', getNotifications);
router.put('/read-all', markAllRead);
router.put('/:id/read', markRead);

export default router;
