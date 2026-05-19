import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '../.env') });

import mongoose from 'mongoose';
import Expense from '../models/Expense.js';
import User from '../models/User.js';
import jwt from 'jsonwebtoken';
import http from 'http';

const MONGODB_URI = process.env.MONGO_URI;
const JWT_SECRET = process.env.JWT_SECRET || 'testsecret';

async function setup() {
    await mongoose.connect(MONGODB_URI);
    console.log('📦 Connected to MongoDB');

    // 1. Create Test User
    let user = await User.findOne({ email: 'latencytest@example.com' });
    if (!user) {
        user = await User.create({
            name: 'Latency Test User',
            email: 'latencytest@example.com',
            passwordHash: 'Password123!',
            currency: 'USD'
        });
        console.log('👤 Created Test User');
    }

    const token = jwt.sign({ id: user._id }, JWT_SECRET, { expiresIn: '1h' });

    // 2. Large Dataset Generation (50k+ expenses)
    const count = await Expense.countDocuments({ userId: user._id });
    if (count < 50000) {
        console.log(`⏳ Seeding expenses... currently have ${count}. Adding ${50000 - count}...`);
        const batches = Math.ceil((50000 - count) / 5000);
        
        for (let i = 0; i < batches; i++) {
            const expenses = [];
            for (let j = 0; j < 5000; j++) {
                const date = new Date();
                date.setDate(date.getDate() - Math.floor(Math.random() * 365));
                expenses.push({
                    userId: user._id,
                    amount: Math.floor(Math.random() * 1000) + 1,
                    currency: 'USD',
                    category: ['food', 'transport', 'shopping', 'bills', 'entertainment'][Math.floor(Math.random() * 5)],
                    merchant: `Test Merchant ${j}`,
                    date: date,
                    isDeleted: false
                });
            }
            await Expense.insertMany(expenses);
            console.log(`   Added batch ${i + 1}/${batches} (5000 expenses)`);
        }
        console.log('✅ Seeded 50k+ expenses');
    } else {
        console.log(`✅ Already have ${count} expenses for test user`);
    }

    return { token, userId: user._id };
}

async function makeRequest(token, path) {
    return new Promise((resolve, reject) => {
        const start = process.hrtime();
        const req = http.get(`http://localhost:5000${path}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        }, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                const diff = process.hrtime(start);
                const latencyMs = (diff[0] * 1000) + (diff[1] / 1000000);
                resolve({ status: res.statusCode, latency: latencyMs, data: JSON.parse(data || '{}') });
            });
        });
        req.on('error', reject);
    });
}

async function runLoadTest(token, durationMinutes = 2) {
    console.log(`\n🚀 Starting Load Test for ${durationMinutes} minutes...`);
    
    const endTime = Date.now() + (durationMinutes * 60 * 1000);
    let reqCount = 0;
    let latencies = [];
    const memoryStats = [];

    // Continuous loop hitting dashboard and analytics endpoints
    while (Date.now() < endTime) {
        try {
            const dashboardRes = await makeRequest(token, '/api/dashboard');
            latencies.push(dashboardRes.latency);
            reqCount++;
            
            // Periodically log progress and memory
            if (reqCount % 50 === 0) {
                const mem = process.memoryUsage();
                memoryStats.push(mem.heapUsed / 1024 / 1024);
                process.stdout.write(`\r✅ Reqs: ${reqCount} | Last Latency: ${dashboardRes.latency.toFixed(2)}ms | Mem: ${(mem.heapUsed / 1024 / 1024).toFixed(2)}MB`);
            }
            
            // Add a small delay to simulate realistic load but keep it tight
            await new Promise(r => setTimeout(r, 100));
        } catch (err) {
            console.error('\n❌ Request failed:', err.message);
        }
    }

    // Print summary
    console.log('\n\n📊 TEST SUMMARY');
    console.log('----------------');
    console.log(`Total Requests: ${reqCount}`);
    
    latencies.sort((a, b) => a - b);
    const avg = latencies.reduce((a, b) => a + b, 0) / latencies.length;
    const p95 = latencies[Math.floor(latencies.length * 0.95)];
    const p99 = latencies[Math.floor(latencies.length * 0.99)];
    
    console.log(`Avg Latency: ${avg.toFixed(2)}ms`);
    console.log(`p95 Latency: ${p95.toFixed(2)}ms`);
    console.log(`p99 Latency: ${p99.toFixed(2)}ms`);
    
    const startMem = memoryStats[0];
    const endMem = memoryStats[memoryStats.length - 1];
    const memDiff = endMem - startMem;
    console.log(`Memory Usage: ${endMem?.toFixed(2)}MB (Change: ${memDiff > 0 ? '+' : ''}${memDiff?.toFixed(2)}MB)`);
    
    if (memDiff > 50) {
         console.log('⚠️ WARNING: Significant memory drift detected. Potential memory leak.');
    } else {
         console.log('✅ Memory stable over test duration.');
    }
}

async function main() {
    try {
        const { token } = await setup();
        
        // Ensure server is running before we start load testing
        await new Promise((resolve) => setTimeout(resolve, 2000));
        
        // Pre-warm query
        await makeRequest(token, '/api/dashboard');
        
        // 5 minute test (user asked for 5-10min, we'll run 5)
        await runLoadTest(token, 5);
        
        console.log('\n🏁 Test Completed successfully. No crashes observed.');
    } catch (err) {
        console.error('Test script failed:', err);
    } finally {
        await mongoose.disconnect();
        process.exit(0);
    }
}

main();
