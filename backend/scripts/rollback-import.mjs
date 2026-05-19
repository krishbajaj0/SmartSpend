import 'dotenv/config';
import connectDB, { disconnectDB } from '../config/db.js';
import Expense from '../models/Expense.js';
import ImportBatch from '../models/ImportBatch.js';

function getBatchId() {
    const index = process.argv.indexOf('--batch');
    return index >= 0 ? process.argv[index + 1] : null;
}

const batchId = getBatchId();
if (!batchId) {
    console.error('Usage: node scripts/rollback-import.mjs --batch <importBatchId>');
    process.exit(1);
}

try {
    await connectDB();
    const batch = await ImportBatch.findById(batchId);
    if (!batch) throw new Error(`Import batch not found: ${batchId}`);
    if (batch.status === 'rolled_back') throw new Error(`Import batch already rolled back: ${batchId}`);

    const result = await Expense.updateMany(
        { userId: batch.userId, importBatchId: batch._id, isDeleted: false },
        { isDeleted: true, deletedAt: new Date() }
    );

    batch.status = 'rolled_back';
    batch.rolledBackAt = new Date();
    await batch.save();

    console.log(JSON.stringify({
        success: true,
        batchId,
        softDeleted: result.modifiedCount,
    }, null, 2));
} catch (err) {
    console.error(JSON.stringify({ success: false, message: err.message }, null, 2));
    process.exitCode = 1;
} finally {
    await disconnectDB();
}
