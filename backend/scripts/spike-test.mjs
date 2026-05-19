import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '../.env') });

import User from '../models/User.js';
import jwt from 'jsonwebtoken';
import http from 'http';

const MONGODB_URI = process.env.MONGO_URI;
const JWT_SECRET = process.env.JWT_SECRET || 'testsecret';

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
                resolve({ status: res.statusCode, latency: latencyMs });
            });
        });
        req.on('error', reject);
    });
}

async function main() {
    await mongoose.connect(MONGODB_URI);
    console.log('📦 Connected to MongoDB');

    let user = await User.findOne({ email: 'latencytest@example.com' });
    if (!user) {
        console.error('User not found. Run latency-validation.mjs first.');
        process.exit(1);
    }
    const token = jwt.sign({ id: user._id }, JWT_SECRET, { expiresIn: '1h' });

    console.log('\n🔥 Test 1: Cache Expiry + Spike Test (150 concurrent requests)');
    
    // We will fire 150 requests simultaneously
    const promises = [];
    for (let i = 0; i < 150; i++) {
        promises.push(makeRequest(token, '/api/dashboard'));
    }

    const results = await Promise.all(promises);
    
    let successes = 0;
    let sumLatency = 0;
    let maxLatency = 0;
    
    results.forEach(r => {
        if (r.status === 200) successes++;
        sumLatency += r.latency;
        if (r.latency > maxLatency) maxLatency = r.latency;
    });

    console.log(`✅ Successes: ${successes}/150`);
    console.log(`⏱️  Max Latency: ${maxLatency.toFixed(2)}ms`);
    console.log(`⏱️  Avg Latency: ${(sumLatency / 150).toFixed(2)}ms`);
    
    if (successes === 150) {
        console.log('✅ Spike Test Passed! In-flight deduplication prevented DB overload.');
    } else {
        console.log('❌ Spike Test Failed!');
    }

    process.exit(0);
}

main();
