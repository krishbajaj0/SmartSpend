import 'dotenv/config';
import mongoose from 'mongoose';

await mongoose.connect(process.env.MONGO_URI);
const col = mongoose.connection.db.collection('users');

const emails = ['testa@smartspend.test', 'testb@smartspend.test'];

await col.updateMany(
    { email: { $in: emails } },
    {
        $set:   { isVerified: true, otpAttempts: 0 },
        $unset: { otp: '', otpExpire: '' },
    }
);

const users = await col
    .find({ email: { $in: emails } })
    .project({ email: 1, isVerified: 1, _id: 1 })
    .toArray();

console.log('Users ready:', JSON.stringify(users, null, 2));
await mongoose.disconnect();
