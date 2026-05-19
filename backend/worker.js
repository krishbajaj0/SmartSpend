import 'dotenv/config';
import logger from './config/logger.js';
import connectDB, { disconnectDB } from './config/db.js';
import { initCronJobs } from './jobs/scheduler.js';

let isShuttingDown = false;

async function shutdown(signal) {
    if (isShuttingDown) return;
    isShuttingDown = true;
    logger.info(`${signal} received. Worker shutting down.`);
    await disconnectDB();
    process.exit(0);
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

process.on('uncaughtException', (err) => {
    logger.fatal({ err }, 'Worker uncaught exception');
    process.exit(1);
});

process.on('unhandledRejection', (reason) => {
    logger.fatal({ err: reason instanceof Error ? reason : new Error(String(reason)) }, 'Worker unhandled rejection');
    process.exit(1);
});

await connectDB();
initCronJobs();
logger.info('SmartSpend worker started. Cron jobs are active in worker process only.');
