import 'dotenv/config';
import mongoose from 'mongoose';
import fs from 'fs';
import { performance } from 'perf_hooks';

// Need to define a minimal Expense schema to interact with MongoDB directly for Phase 14
const ExpenseSchema = new mongoose.Schema({}, { strict: false });
const Expense = mongoose.models.Expense || mongoose.model('Expense', ExpenseSchema, 'expenses');

const API_URL = 'http://localhost:5000/api';
let token = '';
try {
  token = fs.readFileSync('token.txt', 'utf8').trim();
} catch (err) {
  console.log('No token found. Please run audit_phases_1_to_5.js first.');
  process.exit(1);
}

async function request(method, path, body = null) {
  const headers = { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` };
  const options = { method, headers };
  if (body) options.body = JSON.stringify(body);
  
  const res = await fetch(`${API_URL}${path}`, options);
  let data;
  const textData = await res.text();
  try {
    data = JSON.parse(textData);
  } catch(e) {
    data = textData;
  }
  return { status: res.status, data };
}

async function runTests() {
  console.log('--- STARTING AUDIT PHASES 8-14 ---');
  await mongoose.connect('mongodb://127.0.0.1:27017/smartspend');
  
  // PHASE 8: Mixed Workload (Simulation)
  console.log('\\n[Phase 8] Mixed Workload Simulation (Reads, Writes, Analytics)');
  const promises = [];
  // 7 reads
  for(let i=0; i<7; i++) promises.push(request('GET', '/expenses'));
  // 2 writes
  for(let i=0; i<2; i++) promises.push(request('POST', '/expenses', { amount: 50, category: 'food', merchant: 'Mixed Store', date: new Date().toISOString() }));
  // 1 analytics
  promises.push(request('GET', '/analytics/summary?timeframe=month'));
  
  const start = performance.now();
  const results = await Promise.all(promises);
  const end = performance.now();
  console.log(`Mixed workload of 10 concurrent requests completed in ${(end - start).toFixed(2)}ms`);
  const statuses = results.map(r => r.status);
  console.log('Status codes:', statuses);
  const has5xx = statuses.some(s => s >= 500);
  console.log('Any 5xx errors?', has5xx ? 'YES' : 'NO');

  // PHASE 11: Data Consistency (Soft delete, rapid updates)
  console.log('\\n[Phase 11] Data Consistency');
  // Create an expense
  const exp = await request('POST', '/expenses', { amount: 100, category: 'transport', merchant: 'Delete Test', date: new Date().toISOString() });
  if (exp.status === 201) {
    const createdExp = exp.data.data || exp.data;
    const expId = createdExp._id || createdExp.id;
    console.log(`Created expense for soft delete: ${expId}`);
    
    // Soft delete it
    const delRes = await request('DELETE', `/expenses/${expId}`);
    console.log(`Delete status: ${delRes.status}`);
    
    // Try to fetch it via API
    const fetchRes = await request('GET', `/expenses/${expId}`);
    console.log(`Fetch deleted expense status (expect 404): ${fetchRes.status}`);
    
    // Check DB directly to ensure it's still there but marked isDeleted: true
    const dbDoc = await Expense.findOne({ _id: new mongoose.Types.ObjectId(expId) });
    console.log(`Direct DB Check - exists: ${!!dbDoc}, isDeleted: ${dbDoc?.isDeleted}`);
  }

  // PHASE 12: Edge Case Data
  console.log('\\n[Phase 12] Edge Case Data Validation');
  const largeString = 'A'.repeat(2000); // 2000 characters
  const edgeExp = await request('POST', '/expenses', { 
    amount: 0.000000001, 
    category: 'other', 
    merchant: 'Edge Store', 
    notes: largeString,
    date: '2099-12-31T23:59:59.999Z'
  });
  console.log(`Edge Case creation status: ${edgeExp.status}`);
  if (edgeExp.status === 400) {
    console.log(`Validation correctly blocked it:`, edgeExp.data.message);
  } else if (edgeExp.status === 201) {
    console.log(`WARNING: Edge case accepted! Amount: ${edgeExp.data.data?.amount}, Notes length: ${edgeExp.data.data?.notes?.length}`);
  }

  // PHASE 13: Observability
  console.log('\\n[Phase 13] Observability - Checking /api/metrics');
  const metricsRes = await request('GET', '/metrics');
  console.log(`Metrics fetch status: ${metricsRes.status}`);
  if (metricsRes.status === 200) {
    console.log('Metrics Data Keys:', Object.keys(metricsRes.data.metrics || {}));
  }

  // PHASE 14: DB Verification (Query Plans)
  console.log('\\n[Phase 14] DB Verification (Explain Plans)');
  const userIdObj = new mongoose.Types.ObjectId('69ef5eb48f58149874c7dd41'); // arbitrary, we just need explain plan
  const plan = await Expense.find({ userId: userIdObj, isDeleted: false }).sort({ date: -1 }).explain('executionStats');
  console.log(`Query Planner Strategy:`, plan[0]?.queryPlanner?.winningPlan?.stage || plan.queryPlanner?.winningPlan?.stage);
  console.log(`Index Used:`, plan[0]?.queryPlanner?.winningPlan?.inputStage?.indexName || plan.queryPlanner?.winningPlan?.inputStage?.indexName);
  
  console.log('\\n--- TESTS COMPLETE ---');
  process.exit(0);
}

runTests().catch(console.error);
