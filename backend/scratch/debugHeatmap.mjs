import mongoose from 'mongoose';
import constants from './config/constants.js';
await mongoose.connect(constants.mongoUri);
import Transaction from './models/Transaction.js';
import User from './models/User.js';
import { ACTIVE_TRANSACTION_FILTER } from './config/constants.js';

const user = await User.findOne({ email: 'krish1@gmail.com' });
console.log('User:', user?.email, String(user?._id));

const yearAgo = new Date();
yearAgo.setFullYear(yearAgo.getFullYear() - 1);

const sixMonthsAgo = new Date();
sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

// Check with 1 year window (same as backend)
const data = await Transaction.aggregate([
  { $match: { userId: user._id, type: 'EXPENSE', isDeleted: false, date: { $gte: yearAgo } } },
  { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$date' } }, total: { $sum: '$amount' } } },
  { $sort: { _id: 1 } }
]);

console.log('Total heatmap docs (1yr):', data.length);
console.log('Sample (first 5):', JSON.stringify(data.slice(0,5), null, 2));
console.log('Sample (last 5):', JSON.stringify(data.slice(-5), null, 2));

const heatmap = {};
data.forEach(d => { heatmap[d._id] = Math.round(d.total); });
const values = Object.values(heatmap);
console.log('Non-zero days:', Object.keys(heatmap).length);
console.log('Max value:', Math.max(...values));
console.log('Min non-zero value:', Math.min(...values));
console.log('Avg:', Math.round(values.reduce((a,b) => a+b, 0) / values.length));

// Check date format alignment
console.log('\nDate keys sample:', Object.keys(heatmap).slice(0, 5));
console.log('Today would be:', new Date().toISOString().split('T')[0]);

await mongoose.disconnect();
process.exit(0);
