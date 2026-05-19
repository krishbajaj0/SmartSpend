import mongoose from 'mongoose';

await mongoose.connect('mongodb://127.0.0.1:27017/smartspend');

const result = await mongoose.connection.db.collection('users').updateOne(
    { email: 'krishbajaj281@gmail.com' },
    { $unset: { email: '', password: '' } }
);

console.log('Matched:', result.matchedCount, '| Modified:', result.modifiedCount);
process.exit(0);
