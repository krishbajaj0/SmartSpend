import mongoose from 'mongoose';

const savingsGoalSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        index: true,
    },
    name: {
        type: String,
        required: [true, 'Goal name is required'],
        trim: true,
    },
    targetAmount: {
        type: Number,
        required: [true, 'Target amount is required'],
        min: 1,
    },
    currentAmount: { type: Number, default: 0, min: 0 },
    deadline: { type: Date, required: [true, 'Deadline is required'] },
    contributions: [{
        amount: Number,
        date: { type: Date, default: Date.now },
        note: { type: String, default: '' },
    }],
    status: {
        type: String,
        default: 'active',
        enum: ['active', 'completed', 'failed'],
    },
    milestones: [{
        percentage: Number,
        reached: { type: Boolean, default: false },
    }],
}, {
    timestamps: true,
});

const SavingsGoal = mongoose.model('SavingsGoal', savingsGoalSchema);
export default SavingsGoal;
