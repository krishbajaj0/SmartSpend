import express from 'express';
import { protect } from '../middleware/auth.js';
import { generateInsights } from '../services/ai/insightsEngine.js';
import { getSpendingPredictions } from '../services/ai/predictor.js';
import { detectAnomalies } from '../services/ai/anomalyDetector.js';
import { detectRecurringPatterns } from '../services/ai/recurringDetector.js';
import { getBudgetRecommendations } from '../services/ai/budgetAdvisor.js';
import { categorizeExpense } from '../services/ai/categorizer.js';
import { processQuery } from '../services/ai/queryEngine.js';
import { detectSubscriptions } from '../services/ai/subscriptionDetector.js';

const router = express.Router();
router.use(protect);

// GET /api/ai/insights
router.get('/insights', async (req, res, next) => {
    try {
        const insights = await generateInsights(req.user._id);
        res.json({ success: true, insights });
    } catch (err) { next(err); }
});

// GET /api/ai/predictions
router.get('/predictions', async (req, res, next) => {
    try {
        const predictions = await getSpendingPredictions(req.user._id);
        res.json({ success: true, predictions });
    } catch (err) { next(err); }
});

// GET /api/ai/anomalies
router.get('/anomalies', async (req, res, next) => {
    try {
        const anomalies = await detectAnomalies(req.user._id);
        res.json({ success: true, anomalies });
    } catch (err) { next(err); }
});

// GET /api/ai/recurring-patterns
router.get('/recurring-patterns', async (req, res, next) => {
    try {
        const patterns = await detectRecurringPatterns(req.user._id);
        res.json({ success: true, patterns });
    } catch (err) { next(err); }
});

// GET /api/ai/budget-recommendations
router.get('/budget-recommendations', async (req, res, next) => {
    try {
        const recommendations = await getBudgetRecommendations(req.user._id);
        res.json({ success: true, recommendations });
    } catch (err) { next(err); }
});

// POST /api/ai/categorize
router.post('/categorize', async (req, res, next) => {
    try {
        const { merchant, notes, amount } = req.body;
        const result = await categorizeExpense(req.user._id, merchant, notes, amount);
        res.json({ success: true, ...result });
    } catch (err) { next(err); }
});

// POST /api/ai/query — Natural language spending search
router.post('/query', async (req, res, next) => {
    try {
        const { query } = req.body;
        if (!query || query.trim().length === 0) {
            return res.status(400).json({ success: false, message: 'Query is required' });
        }
        const result = await processQuery(req.user._id, query.trim());
        res.json({ success: true, ...result });
    } catch (err) { next(err); }
});

// GET /api/ai/subscriptions — Detect recurring payments
router.get('/subscriptions', async (req, res, next) => {
    try {
        const subscriptions = await detectSubscriptions(req.user._id);
        res.json({ success: true, subscriptions });
    } catch (err) { next(err); }
});

export default router;
