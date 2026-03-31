import Notification from '../models/Notification.js';
import { AppError } from '../middleware/errorHandler.js';

// GET /api/notifications
export async function getNotifications(req, res, next) {
    try {
        const { page = 1, limit = 20 } = req.query;
        const filter = { userId: req.user._id };
        const skip = (Number(page) - 1) * Number(limit);

        const [notifications, total, unreadCount] = await Promise.all([
            Notification.find(filter).sort({ read: 1, createdAt: -1 }).skip(skip).limit(Number(limit)),
            Notification.countDocuments(filter),
            Notification.countDocuments({ ...filter, read: false }),
        ]);

        res.json({
            success: true,
            notifications,
            unreadCount,
            pagination: { page: Number(page), limit: Number(limit), total },
        });
    } catch (err) { next(err); }
}

// PUT /api/notifications/:id/read
export async function markRead(req, res, next) {
    try {
        const notif = await Notification.findOneAndUpdate(
            { _id: req.params.id, userId: req.user._id },
            { read: true },
            { new: true }
        );
        if (!notif) throw new AppError('Notification not found', 404);
        res.json({ success: true, notification: notif });
    } catch (err) { next(err); }
}

// PUT /api/notifications/read-all
export async function markAllRead(req, res, next) {
    try {
        await Notification.updateMany({ userId: req.user._id, read: false }, { read: true });
        res.json({ success: true, message: 'All notifications marked as read' });
    } catch (err) { next(err); }
}

// Helper: create notification (used by services)
export async function createNotification(userId, type, title, message, priority = 3, metadata = {}) {
    return Notification.create({ userId, type, title, message, priority, metadata });
}
