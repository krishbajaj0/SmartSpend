import mongoose from 'mongoose';

const jobLockSchema = new mongoose.Schema({
    key: { type: String, required: true, unique: true },
    owner: { type: String, required: true },
    lockedUntil: { type: Date, required: true, index: true },
    lastStartedAt: Date,
    lastCompletedAt: Date,
    lastError: String,
}, { timestamps: true });

const JobLock = mongoose.model('JobLock', jobLockSchema);
export default JobLock;
