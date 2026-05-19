/**
 * Diagnose the exact failure mode from load test T1 and T2.
 */
import 'dotenv/config';

const BASE = 'http://localhost:5000/api';
const HDR  = { 'Content-Type': 'application/json' };

const loginR = await fetch(`${BASE}/auth/login`, {
    method: 'POST', headers: HDR,
    body: JSON.stringify({ email: 'testa@smartspend.test', password: 'Password123' }),
});
const { token: TOKEN } = await loginR.json();

// Sample 5 requests and capture full response
for (let i = 0; i < 5; i++) {
    const r = await fetch(`${BASE}/expenses`, {
        headers: { ...HDR, Authorization: `Bearer ${TOKEN}` },
    });
    const body = await r.json();
    console.log(`Request ${i+1}: status=${r.status} success=${body.success} msg=${body.message}`);
}

// Try a POST
const rp = await fetch(`${BASE}/expenses`, {
    method: 'POST',
    headers: { ...HDR, Authorization: `Bearer ${TOKEN}` },
    body: JSON.stringify({ amount: 50, merchant: 'DiagTest', category: 'food', date: '2026-04-01' }),
});
const bodyP = await rp.json();
console.log(`\nPOST: status=${rp.status} success=${bodyP.success} msg=${bodyP.message}`);

// Check rate limit headers
const r2 = await fetch(`${BASE}/expenses`, {
    headers: { ...HDR, Authorization: `Bearer ${TOKEN}` },
});
console.log('\nRate limit headers:');
console.log('  RateLimit-Limit   :', r2.headers.get('ratelimit-limit'));
console.log('  RateLimit-Remaining:', r2.headers.get('ratelimit-remaining'));
console.log('  RateLimit-Reset   :', r2.headers.get('ratelimit-reset'));
console.log('  Retry-After       :', r2.headers.get('retry-after'));
console.log('  X-RateLimit-*     :', r2.headers.get('x-ratelimit-limit'));
