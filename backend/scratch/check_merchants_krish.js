import mongoose from 'mongoose';
import Transaction from '../models/Transaction.js';
import dotenv from 'dotenv';
dotenv.config();

async function check() {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/smartspend');
    const userId = new mongoose.Types.ObjectId('69ee608d478a0000302f2c90');
    const res = await Transaction.aggregate([
        { $match: { userId, type: 'EXPENSE' } },
        { $group: { _id: { $ifNull: ['$merchant', '$note', 'Unknown'] }, total: { $sum: '$amount' }, count: { $sum: 1 } } },
        { $sort: { total: -1 } }
    ]);
    console.log(JSON.stringify(res, null, 2));
    process.exit(0);
}
check();
