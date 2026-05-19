import 'dotenv/config';
import mongoose from 'mongoose';

await mongoose.connect(process.env.MONGO_URI);
const Expense = (await import('../models/Expense.js')).default;

// 1. List all indexes on the expenses collection
const indexes = await Expense.collection.indexes();
console.log('\n--- Current Expense Indexes ---');
indexes.forEach(idx => console.log(JSON.stringify(idx.key), idx.name));

// 2. Try the text search query directly
try {
    const userId = new mongoose.Types.ObjectId('69ee606a478a0000302f2c8c');
    const result = await Expense.find({
        userId,
        isDeleted: false,
        $text: { $search: 'swiggy' },
    }).maxTimeMS(5000).lean();
    console.log('\nText search result count:', result.length);
} catch (e) {
    console.log('\nText search ERROR:', e.name, '|', e.message, '| code:', e.code);
}

// 3. Check if there's actually a text index
const textIdx = indexes.find(i => Object.values(i.key).includes('text'));
console.log('\nText index exists:', !!textIdx);
if (textIdx) console.log('Text index key:', JSON.stringify(textIdx.key));

await mongoose.disconnect();
