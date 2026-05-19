import mongoose from 'mongoose';
import logger from '../config/logger.js';

/**
 * Safely starts a Mongoose transaction ONLY if the database topology supports it.
 * Standalone MongoDB instances (like default local Windows installs) will return null,
 * gracefully degrading to non-transactional operations.
 */
export async function startTransactionIfSupported() {
    const uri = process.env.MONGO_URI || '';
    const isAtlas = uri.startsWith('mongodb+srv://');
    const isReplicaSet = uri.includes('replicaSet=');

    if (isAtlas || isReplicaSet) {
        const session = await mongoose.startSession();
        session.startTransaction();
        return session;
    }
    
    // Fallback for standalone local MongoDB
    return null;
}

export async function commitTransactionIfSupported(session) {
    if (session) {
        await session.commitTransaction();
        session.endSession();
    }
}

export async function abortTransactionIfSupported(session) {
    if (session) {
        await session.abortTransaction();
        session.endSession();
    }
}
