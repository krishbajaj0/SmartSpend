import express from 'express';
import { protect } from '../middleware/auth.js';
import { createGoal, getGoals, getGoal, updateGoal, deleteGoal, contribute, getProgress } from '../controllers/goalController.js';

const router = express.Router();
router.use(protect);

router.route('/').get(getGoals).post(createGoal);
router.route('/:id').get(getGoal).put(updateGoal).delete(deleteGoal);
router.post('/:id/contribute', contribute);
router.get('/:id/progress', getProgress);

export default router;
