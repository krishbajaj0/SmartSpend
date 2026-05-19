import 'dotenv/config';
import crypto from 'crypto';
import mongoose from 'mongoose';
import bcrypt from 'bcrypt';
import fs from 'fs';

// Need to define a minimal User schema to interact with MongoDB directly since importing fails due to paths/ESM issues
const UserSchema = new mongoose.Schema({
  name: String, email: String, passwordHash: String, isVerified: Boolean, currency: String
}, { timestamps: true });
const User = mongoose.models.User || mongoose.model('User', UserSchema);

const API_URL = 'http://localhost:5000/api';
let token = '';
let userId = '';
const email = `audit_${Date.now()}@test.com`;
const password = 'Password123!';

async function request(method, path, body = null, useToken = true) {
  const headers = { 'Content-Type': 'application/json' };
  if (useToken && token) headers['Authorization'] = `Bearer ${token}`;
  
  const options = { method, headers };
  if (body) options.body = JSON.stringify(body);
  
  const res = await fetch(`${API_URL}${path}`, options);
  const textData = await res.text();
  let data;
  try {
    data = JSON.parse(textData);
  } catch(e) {
    data = textData;
  }
  return { status: res.status, data };
}

async function runTests() {
  console.log('--- STARTING AUDIT PHASES 1-5 ---');
  
  // Setup User Directly in DB to avoid OTP issues
  await mongoose.connect('mongodb://127.0.0.1:27017/smartspend');
  const salt = await bcrypt.genSalt(10);
  const hashedPassword = await bcrypt.hash(password, salt);
  await new User({ name: 'Audit E2E User', email, passwordHash: hashedPassword, isVerified: true, currency: 'USD' }).save();
  console.log('User directly injected into MongoDB as verified.');
  
  // Phase 1: End-to-End
  console.log('\\n[Phase 1] Login');
  const loginRes = await request('POST', '/auth/login', { email, password }, false);
  console.log('Login status:', loginRes.status);
  if (!loginRes.data.token) {
    console.log('Login failed', loginRes.data);
    process.exit(1);
  }
  token = loginRes.data.token;
  userId = loginRes.data.user.id;
  
  // Save token for autocannon
  fs.writeFileSync('token.txt', token);
  
  console.log('\\n[Phase 1] Creating Expenses');
  let expIds = [];
  for(let i=1; i<=5; i++) {
    const exp = await request('POST', '/expenses', {
      amount: 10 * i,
      category: 'food',
      merchant: 'Audit Store',
      description: `Audit expense ${i}`,
      date: new Date().toISOString()
    });
    if(exp.status === 201) {
      const createdExp = exp.data.data || exp.data;
      expIds.push(createdExp._id);
    } else {
      console.log('Failed to create expense:', exp.status, exp.data);
    }
  }
  console.log(`Created ${expIds.length} expenses. Status code for last: ${expIds.length === 5 ? 201 : 'Failed'}`);
  
  console.log('\\n[Phase 1] Dashboard Validation');
  const dashRes = await request('GET', '/dashboard');
  console.log('Dashboard status:', dashRes.status);
  if(dashRes.data.data) {
     console.log('Total Expenses in Dashboard:', dashRes.data.data.metrics?.totalExpenses);
  }
  
  // Phase 2: Error simulation
  console.log('\\n[Phase 2] Error Simulation');
  const err400 = await request('POST', '/expenses', {});
  console.log('400 (Bad Request) status:', err400.status);
  
  const err401 = await request('GET', '/dashboard', null, false);
  console.log('401 (Missing Token) status:', err401.status);
  
  const err404 = await request('GET', '/nonexistent');
  console.log('404 status:', err404.status);
  
  // Phase 3: Security
  console.log('\\n[Phase 3] Security - XSS Payload');
  const xssExp = await request('POST', '/expenses', {
    amount: 99,
    category: 'other',
    merchant: 'XSS Store 2',
    notes: '<script>alert("XSS")</script><img src=x onerror=alert(1)>',
    date: new Date().toISOString()
  });
  console.log('XSS creation status:', xssExp.status, 'Response notes:', xssExp.data.data?.notes || xssExp.data.message);
  
  console.log('\\n[Phase 3] Security - Mass Assignment');
  const massExp = await request('POST', '/expenses', {
    amount: 50,
    category: 'food',
    merchant: 'Mass Store',
    description: 'Mass Assignment Test',
    date: new Date().toISOString(),
    user: '60d5ecb8b392d71234567890', // Trying to assign to another user
    role: 'admin' // Trying to mass assign role
  });
  console.log('Mass assignment creation user ID:', massExp.data.data?.user || massExp.data.message, 'vs your ID:', userId);
  
  // Phase 4: Token & Session
  console.log('\\n[Phase 4] Token Logout & Reuse');
  const logoutRes = await request('POST', '/auth/logout');
  console.log('Logout status:', logoutRes.status);
  
  const reuseToken = await request('GET', '/dashboard');
  console.log('Reuse token after logout status:', reuseToken.status, reuseToken.data.message);
  
  console.log('\\n--- TESTS COMPLETE ---');
  process.exit(0);
}

runTests().catch(console.error);
