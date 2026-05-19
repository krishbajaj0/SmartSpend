import mongoose from 'mongoose';
import bcrypt from 'bcrypt';
import User from '../models/User.js';

async function setup() {
  await mongoose.connect('mongodb://127.0.0.1:27017/smartspend');
  const email = 'e2e_user@test.com';
  
  await User.deleteOne({ email });
  
  const salt = await bcrypt.genSalt(10);
  const hashedPassword = await bcrypt.hash('Password123!', salt);
  
  const user = new User({
    name: 'E2E Test User',
    email,
    password: hashedPassword,
    isVerified: true,
    currency: 'USD',
  });
  
  await user.save();
  console.log('User created:', email);
  process.exit(0);
}

setup().catch(console.error);
