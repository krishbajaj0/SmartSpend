/**
 * Load test: simulates concurrent users hitting the expense endpoints.
 * Measures: p50, p95, p99 latency, error rate, throughput.
 * Run with: node scripts/load-test.mjs
 */
import 'dotenv/config';

const BASE   = 'http://localhost:5000/api';
const HDR    = { 'Content-Type': 'application/json' };

// ── helpers ──────────────────────────────────────────────────────────────────
async function post(path, body, token) {
    const r = await fetch(`${BASE}${path}`, {
        method: 'POST', headers: { ...HDR, Authorization: `Bearer ${token}` },
        body: JSON.stringify(body),
    });
    return { status: r.status, body: await r.json().catch(() => ({})) };
}

async function get(path, token) {
    const r = await fetch(`${BASE}${path}`, {
        headers: { ...HDR, Authorization: `Bearer ${token}` },
    });
    return { status: r.status, body: await r.json().catch(() => ({})) };
}

function percentile(arr, p) {
    const s = [...arr].sort((a, b) => a - b);
    return s[Math.ceil(p / 100 * s.length) - 1] ?? 0;
}

function printStats(label, durations, errors, total) {
    console.log(`\n  ${label}`);
    console.log(`    Requests   : ${total}`);
    console.log(`    Errors     : ${errors} (${((errors / total) * 100).toFixed(1)}%)`);
    console.log(`    p50        : ${percentile(durations, 50)}ms`);
    console.log(`    p95        : ${percentile(durations, 95)}ms`);
    console.log(`    p99        : ${percentile(durations, 99)}ms`);
    console.log(`    min / max  : ${Math.min(...durations)}ms / ${Math.max(...durations)}ms`);
}

async function runBatch(fn, concurrency, iterations) {
    const durations = [];
    let errors = 0;
    const total = concurrency * iterations;

    for (let i = 0; i < iterations; i++) {
        const batch = Array.from({ length: concurrency }, async () => {
            const t0 = Date.now();
            try {
                const r = await fn();
                const d = Date.now() - t0;
                durations.push(d);
                if (r.status >= 400) errors++;
            } catch {
                durations.push(Date.now() - t0);
                errors++;
            }
        });
        await Promise.all(batch);
    }
    return { durations, errors, total };
}

// ── setup ─────────────────────────────────────────────────────────────────────
const loginR = await post('/auth/login', {
    email: 'testa@smartspend.test', password: 'Password123',
});
if (!loginR.body.token) { console.error('Login failed'); process.exit(1); }
const TOKEN = loginR.body.token;

// Seed one expense to GET/update
const seedR = await post('/expenses', {
    amount: 99, merchant: 'LoadSeed', category: 'food', date: '2026-04-01',
}, TOKEN);
const SEED_ID = seedR.body.expense?._id;

console.log('\n══════════════════════════════════════════════════════════');
console.log('  LOAD TEST — SmartSpend Expense Module');
console.log('══════════════════════════════════════════════════════════');
console.log(`  Seed expense ID: ${SEED_ID}`);

// ═══════════════════════════════════════════════════════════════════
// TEST 1: GET /expenses — 50 concurrent, 5 iterations = 250 requests
// ═══════════════════════════════════════════════════════════════════
console.log('\n── T1: GET /expenses (50 concurrent × 5 iter = 250 req) ──────');
{
    const { durations, errors, total } = await runBatch(
        () => get('/expenses?page=1&limit=20', TOKEN),
        50, 5
    );
    printStats('GET /expenses', durations, errors, total);
}

// ═══════════════════════════════════════════════════════════════════
// TEST 2: POST /expenses — 20 concurrent × 5 = 100 creates
// ═══════════════════════════════════════════════════════════════════
console.log('\n── T2: POST /expenses (20 concurrent × 5 iter = 100 req) ─────');
const createdIds = [];
{
    const { durations, errors, total } = await runBatch(async () => {
        const r = await post('/expenses', {
            amount: Math.round(Math.random() * 1000) + 1,
            merchant: `Merchant-${Date.now()}`,
            category: ['food', 'transport', 'shopping'][Math.floor(Math.random() * 3)],
            date: '2026-04-01',
        }, TOKEN);
        if (r.body.expense?._id) createdIds.push(r.body.expense._id);
        return r;
    }, 20, 5);
    printStats('POST /expenses', durations, errors, total);
}

// ═══════════════════════════════════════════════════════════════════
// TEST 3: Mixed read/write — 100 concurrent (realistic traffic)
// ═══════════════════════════════════════════════════════════════════
console.log('\n── T3: Mixed 70% GET / 30% POST (100 concurrent × 3) ─────────');
{
    const ops = Array.from({ length: 100 }, (_, i) =>
        i < 70
            ? () => get('/expenses?category=food&limit=10', TOKEN)
            : () => post('/expenses', {
                amount: 50, merchant: `Mix-${i}`, category: 'food', date: '2026-04-01',
              }, TOKEN)
    );
    const durations = [];
    let errors = 0;
    for (let iter = 0; iter < 3; iter++) {
        await Promise.all(ops.map(async (fn) => {
            const t0 = Date.now();
            try {
                const r = await fn();
                durations.push(Date.now() - t0);
                if (r.status >= 500) errors++;
            } catch { durations.push(Date.now() - t0); errors++; }
        }));
    }
    printStats('Mixed R/W', durations, errors, 300);
}

// ═══════════════════════════════════════════════════════════════════
// TEST 4: Analytics endpoints — most expensive queries
// ═══════════════════════════════════════════════════════════════════
console.log('\n── T4: Analytics endpoints (20 concurrent × 3) ───────────────');
{
    const endpoints = [
        '/analytics/summary',
        '/analytics/category-breakdown',
        '/analytics/monthly-trend',
        '/analytics/weekly-pattern',
        '/analytics/top-merchants',
    ];
    const durations = [];
    let errors = 0;
    for (let iter = 0; iter < 3; iter++) {
        await Promise.all(
            Array.from({ length: 20 }, async () => {
                const ep = endpoints[Math.floor(Math.random() * endpoints.length)];
                const t0 = Date.now();
                try {
                    const r = await get(ep, TOKEN);
                    durations.push(Date.now() - t0);
                    if (r.status >= 500) errors++;
                } catch { durations.push(Date.now() - t0); errors++; }
            })
        );
    }
    printStats('Analytics', durations, errors, 60);
}

// ═══════════════════════════════════════════════════════════════════
// TEST 5: Pagination at extremes
// ═══════════════════════════════════════════════════════════════════
console.log('\n── T5: Extreme pagination ─────────────────────────────────────');
{
    const cases = [
        '/expenses?page=1&limit=100',
        '/expenses?page=1000&limit=100',
        '/expenses?dateFrom=2020-01-01&dateTo=2026-12-31&limit=100',
    ];
    for (const url of cases) {
        const t0 = Date.now();
        const r  = await get(url, TOKEN);
        const ms = Date.now() - t0;
        console.log(`    ${url.slice(0, 60).padEnd(60)} → ${r.status} (${ms}ms)`);
    }
}

// ── cleanup ───────────────────────────────────────────────────────
if (createdIds.length > 0) {
    const chunkSize = 500;
    for (let i = 0; i < createdIds.length; i += chunkSize) {
        await post('/expenses/bulk-delete', { ids: createdIds.slice(i, i + chunkSize) }, TOKEN);
    }
    await post(`/expenses/${SEED_ID}`, null, TOKEN); // will 404 gracefully
    await fetch(`${BASE}/expenses/${SEED_ID}`, {
        method: 'DELETE', headers: { ...HDR, Authorization: `Bearer ${TOKEN}` }
    });
}

console.log('\n══════════════════════════════════════════════════════════');
console.log('  LOAD TEST COMPLETE');
console.log('══════════════════════════════════════════════════════════\n');
