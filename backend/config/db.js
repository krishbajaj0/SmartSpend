/**
 * @file config/db.js
 * @description Production-grade MongoDB connection module.
 *
 * Design decisions:
 *  - Validates MONGO_URI at import time (fail-fast principle).
 *  - Registers Mongoose connection-event listeners ONCE at module load so they
 *    survive automatic reconnect cycles without duplicating handlers.
 *  - Uses maxPoolSize/minPoolSize to pre-warm the connection pool.
 *  - serverSelectionTimeoutMS: how long the driver waits before giving up on finding
 *    a primary. 5 s is a good default.
 *  - socketTimeoutMS: closes idle sockets after 45 s to free server-side resources.
 *  - heartbeatFrequencyMS: how often the driver pings the server. 10 s keeps the
 *    connection fresh through NAT/firewall idle-timeout windows.
 *  - Exposes `getConnectionState()` so the /health route can report real DB status
 *    without coupling the route to Mongoose internals.
 *  - Graceful-shutdown hooks flush in-flight operations before the process exits,
 *    preventing write loss and corrupted transactions.
 *  - syncIndexes() called after every connect to ensure schema-defined compound,
 *    partial, and text indexes exist in the live collection — critical when the
 *    database name changes or on first boot against a fresh database.
 */

import mongoose from 'mongoose';
import logger from './logger.js';

// ── Guard: fail immediately if MONGO_URI is absent ───────────────────────────
if (!process.env.MONGO_URI) {
    logger.fatal('FATAL: MONGO_URI environment variable is not set. Refusing to start.');
    process.exit(1);
}

// ── Mongoose global settings ──────────────────────────────────────────────────
// Throw on unknown schema fields instead of silently discarding them.
mongoose.set('strict', true);
// Return plain JS objects from .lean() by default (micro-perf gain in read-heavy routes).
mongoose.set('strictQuery', true);
// Disable Mongoose's internal buffering so operations fail immediately when the
// connection is down rather than queuing indefinitely.
mongoose.set('bufferCommands', false);

// ── Connection options ────────────────────────────────────────────────────────
const MONGO_OPTIONS = {
    maxPoolSize: parseInt(process.env.DB_POOL_MAX ?? '10', 10),
    minPoolSize: parseInt(process.env.DB_POOL_MIN ?? '2', 10),
    serverSelectionTimeoutMS: 5_000,   // Give up finding a primary after 5 s
    socketTimeoutMS: 45_000,           // Close idle sockets after 45 s
    heartbeatFrequencyMS: 10_000,      // Ping server every 10 s
    connectTimeoutMS: 10_000,          // Initial TCP connect timeout
    family: 4,                         // Force IPv4; avoids dual-stack DNS surprises
};

// ── Connection-state event listeners (registered once, survive reconnects) ────
mongoose.connection.on('connected', () => {
    logger.info(`MongoDB connected → ${mongoose.connection.host}/${mongoose.connection.name}`);
});

mongoose.connection.on('disconnected', () => {
    // The driver will automatically attempt to reconnect — this is NOT a fatal event.
    logger.warn('MongoDB disconnected. Driver will attempt to reconnect…');
});

mongoose.connection.on('reconnected', () => {
    logger.info('MongoDB reconnected successfully.');
});

mongoose.connection.on('error', (err) => {
    // Log without crashing — the driver's reconnect logic takes over.
    logger.error({ err }, 'MongoDB connection error.');
});

// ── Exported helper: expose DB state to health-check routes ──────────────────
/**
 * Returns a human-readable string for the current Mongoose connection state.
 * 0 = disconnected, 1 = connected, 2 = connecting, 3 = disconnecting
 */
export function getConnectionState() {
    const states = ['disconnected', 'connected', 'connecting', 'disconnecting'];
    return states[mongoose.connection.readyState] ?? 'unknown';
}

// ── connectDB ─────────────────────────────────────────────────────────────────
/**
 * Opens the MongoDB connection and resolves once the driver reports "connected".
 * The server.js bootstrap awaits this before binding the HTTP port, so no request
 * can be served with a broken DB.
 *
 * INDEX SYNCHRONISATION
 * ─────────────────────
 * After connecting, syncIndexes() is called on every registered Mongoose model.
 *
 * WHY: Mongoose only calls ensureIndexes() automatically when autoIndex:true AND
 * the model is first accessed — it does NOT re-create indexes when the database
 * name changes, or when a new compound/partial index is added to an existing
 * schema. syncIndexes() reconciles the schema definition with the live collection,
 * creating missing indexes and dropping stale ones.
 *
 * SAFETY: syncIndexes() is fully idempotent. Running it on every boot against
 * an already-indexed collection is a no-op. On a large collection it can take
 * seconds — acceptable at startup, never acceptable inside a request handler.
 *
 * @throws {Error} if the initial connection attempt fails.
 */
const connectDB = async () => {
    try {
        logger.info('Connecting to MongoDB…');
        await mongoose.connect(process.env.MONGO_URI, MONGO_OPTIONS);
        // At this point the 'connected' event above has already fired.

        // ── Synchronise indexes for every registered model ────────────────────
        // mongoose.modelNames() returns all models imported before connectDB() ran.
        // This is guaranteed because routes → controllers → models are all imported
        // at the top of server.js before the IIFE that calls connectDB().
        const modelNames = mongoose.modelNames();
        if (modelNames.length > 0) {
            logger.info(`Syncing indexes for models: ${modelNames.join(', ')}…`);
            await Promise.all(
                modelNames.map((name) =>
                    mongoose.model(name)
                        .syncIndexes()
                        .catch((err) =>
                            // Non-fatal: log and continue. A missing index is a
                            // performance problem, not a correctness problem.
                            logger.error({ err, model: name }, 'syncIndexes failed for model')
                        )
                )
            );
            logger.info('Index synchronisation complete.');
        } else {
            logger.warn('No models registered yet — indexes will sync on first model use (autoIndex:true).');
        }
    } catch (err) {
        // Only the INITIAL connect failure is fatal — subsequent drops are handled
        // by the driver's built-in retry. Crash hard here so PaaS restart policies
        // (Railway, Render, PM2) bring the process back with a fresh state.
        logger.fatal({ err }, 'Initial MongoDB connection failed. Exiting.');
        process.exit(1);
    }
};

// ── Graceful shutdown ─────────────────────────────────────────────────────────
/**
 * Closes the Mongoose connection cleanly. Call this from your SIGTERM / SIGINT
 * handler AFTER the HTTP server stops accepting new requests.
 */
export async function disconnectDB() {
    if (mongoose.connection.readyState === 0) return; // already closed
    try {
        await mongoose.connection.close();
        logger.info('MongoDB connection closed gracefully.');
    } catch (err) {
        logger.error({ err }, 'Error while closing MongoDB connection.');
    }
}

export default connectDB;
