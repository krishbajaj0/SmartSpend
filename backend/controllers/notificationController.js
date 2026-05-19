import Notification from '../models/Notification.js';
import User from '../models/User.js';
import { AppError } from '../middleware/errorHandler.js';
import { emitToUser } from '../services/socketService.js';
import { sendNotificationEmail } from '../services/emailService.js';

// GET /api/notifications
export async function getNotifications(req, res, next) {
    try {
        const { page = 1, limit = 20 } = req.query;
        const filter = { userId: req.user._id };
        const skip = (Number(page) - 1) * Number(limit);

        const [notifications, total, unreadCount] = await Promise.all([
            Notification.find(filter).sort({ read: 1, createdAt: -1 }).skip(skip).limit(Number(limit)).lean(),
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
    const notification = await Notification.create({ userId, type, title, message, priority, metadata });
    
    // Emit via WebSocket
    emitToUser(userId, 'notification', notification);

    // Send email ONLY for high priority alerts (4 and 5)
    if (priority >= 4) {
        try {
            const user = await User.findById(userId);
            if (user && user.notificationPreferences?.email !== false) {
                // If the email service has a generic notification email sender, trigger it here
                // Assumes sendNotificationEmail exists or is implemented below
                if (typeof sendNotificationEmail === 'function') {
                    await sendNotificationEmail(user.email, user.name, title, message);
                }
            }
        } catch (err) {
            console.error('Failed to send high-priority notification email:', err.message);
        }
    }

    return notification;
}
