import 'dotenv/config'; // SMTP credentials updated
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import rateLimit from 'express-rate-limit';
import connectDB from './config/db.js';
import constants from './config/constants.js';
import { errorHandler } from './middleware/errorHandler.js';
import { requestLogger } from './middleware/logger.js';

// Route imports
import authRoutes from './routes/auth.js';
import expenseRoutes from './routes/expenses.js';
import budgetRoutes from './routes/budgets.js';
import goalRoutes from './routes/goals.js';
import receiptRoutes from './routes/receipts.js';
import analyticsRoutes from './routes/analytics.js';
import notificationRoutes from './routes/notifications.js';
import aiRoutes from './routes/ai.js';
import importRoutes from './routes/import.js';
import dashboardRoutes from './routes/dashboard.js';
import { initCronJobs } from './jobs/scheduler.js';

const app = express();

// ── Security & Parsing ──
app.use(helmet());
app.use(compression());
app.use(cors({
    origin: constants.frontendUrl,
    credentials: true,
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// ── Logging ──
app.use(requestLogger);

// ── Rate Limiting ──
const generalLimiter = rateLimit({
    windowMs: constants.rateLimit.general.windowMs,
    max: constants.rateLimit.general.max,
    message: { success: false, message: 'Too many requests, try again later' },
});
app.use('/api', generalLimiter);

// ── Static files (uploaded receipts) ──
app.use('/uploads', express.static('uploads'));

// ── Routes ──
app.use('/api/auth', authRoutes);
app.use('/api/expenses', expenseRoutes);
app.use('/api/budgets', budgetRoutes);
app.use('/api/goals', goalRoutes);
app.use('/api/receipts', receiptRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api/import', importRoutes);
app.use('/api/dashboard', dashboardRoutes);

// ── Health check ──
app.get('/api/health', (req, res) => {
    res.json({ success: true, message: 'SmartExpense API is running', timestamp: new Date() });
});

// ── Error handling ──
app.use(errorHandler);

// ── Start ──
const PORT = constants.port;
connectDB().then(() => {
    app.listen(PORT, () => {
        console.log(`🚀 Server running on port ${PORT}`);
        console.log(`📧 SMTP User: ${process.env.SMTP_USER ? process.env.SMTP_USER : 'Not Configured (MOCK MODE)'}`);
        initCronJobs();
    });
});

export default app;
