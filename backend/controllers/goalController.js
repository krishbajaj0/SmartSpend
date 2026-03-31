import SavingsGoal from '../models/SavingsGoal.js';
import { AppError } from '../middleware/errorHandler.js';

// POST /api/goals
export async function createGoal(req, res, next) {
    try {
        const goal = await SavingsGoal.create({
            ...req.body,
            userId: req.user._id,
            milestones: [25, 50, 75, 100].map(p => ({ percentage: p, reached: false })),
        });
        res.status(201).json({ success: true, goal });
    } catch (err) { next(err); }
}

// GET /api/goals
export async function getGoals(req, res, next) {
    try {
        const goals = await SavingsGoal.find({ userId: req.user._id }).sort({ createdAt: -1 });
        res.json({ success: true, goals });
    } catch (err) { next(err); }
}

// GET /api/goals/:id
export async function getGoal(req, res, next) {
    try {
        const goal = await SavingsGoal.findOne({ _id: req.params.id, userId: req.user._id });
        if (!goal) throw new AppError('Goal not found', 404);
        res.json({ success: true, goal });
    } catch (err) { next(err); }
}

// PUT /api/goals/:id
export async function updateGoal(req, res, next) {
    try {
        const goal = await SavingsGoal.findOneAndUpdate(
            { _id: req.params.id, userId: req.user._id },
            req.body,
            { new: true, runValidators: true }
        );
        if (!goal) throw new AppError('Goal not found', 404);
        res.json({ success: true, goal });
    } catch (err) { next(err); }
}

// DELETE /api/goals/:id
export async function deleteGoal(req, res, next) {
    try {
        await SavingsGoal.findOneAndDelete({ _id: req.params.id, userId: req.user._id });
        res.json({ success: true, message: 'Goal deleted' });
    } catch (err) { next(err); }
}

// POST /api/goals/:id/contribute
export async function contribute(req, res, next) {
    try {
        const { amount, note } = req.body;
        if (!amount || amount <= 0) throw new AppError('Amount must be positive', 400);

        const goal = await SavingsGoal.findOne({ _id: req.params.id, userId: req.user._id });
        if (!goal) throw new AppError('Goal not found', 404);
        if (goal.status === 'completed') throw new AppError('Goal already completed', 400);

        goal.currentAmount = Math.min(goal.currentAmount + amount, goal.targetAmount);
        goal.contributions.push({ amount, date: new Date(), note: note || '' });

        // Update milestones
        const pct = (goal.currentAmount / goal.targetAmount) * 100;
        goal.milestones = goal.milestones.map(m => ({
            ...m,
            reached: pct >= m.percentage,
        }));

        if (goal.currentAmount >= goal.targetAmount) {
            goal.status = 'completed';
        }

        await goal.save();
        res.json({ success: true, goal });
    } catch (err) { next(err); }
}

// GET /api/goals/:id/progress
export async function getProgress(req, res, next) {
    try {
        const goal = await SavingsGoal.findOne({ _id: req.params.id, userId: req.user._id });
        if (!goal) throw new AppError('Goal not found', 404);

        const pct = (goal.currentAmount / goal.targetAmount) * 100;
        const remaining = goal.targetAmount - goal.currentAmount;
        const daysLeft = Math.max(0, Math.ceil((new Date(goal.deadline) - new Date()) / 86400000));
        const dailyNeeded = daysLeft > 0 ? remaining / daysLeft : remaining;

        res.json({
            success: true,
            progress: {
                percentage: Math.round(pct),
                remaining,
                daysLeft,
                dailyNeeded: Math.round(dailyNeeded),
                milestones: goal.milestones,
                status: goal.status,
                estimatedCompletion: daysLeft > 0 && goal.contributions.length > 0
                    ? new Date(Date.now() + (remaining / (goal.currentAmount / Math.max(1, goal.contributions.length))) * 30 * 86400000)
                    : null,
            },
        });
    } catch (err) { next(err); }
}
