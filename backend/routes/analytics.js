import express from 'express';
import { protect } from '../middleware/auth.js';
import {
    getSummary, getCategoryBreakdown, getMonthlyTrend, getComparison,
    getWeeklyPattern, getTopMerchants, getHeatmap, getCategoryOverTime, exportData,
} from '../controllers/analyticsController.js';

const router = express.Router();
router.use(protect);

router.get('/summary', getSummary);
router.get('/category-breakdown', getCategoryBreakdown);
router.get('/monthly-trend', getMonthlyTrend);
router.get('/comparison', getComparison);
router.get('/weekly-pattern', getWeeklyPattern);
router.get('/top-merchants', getTopMerchants);
router.get('/heatmap', getHeatmap);
router.get('/category-over-time', getCategoryOverTime);
router.get('/export', exportData);

export default router;
