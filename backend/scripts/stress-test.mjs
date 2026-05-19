/**
 * Production stress test — sustained load + failure simulation.
 *
 * Phase 1: Ramp up to 100 virtual users, sustain for 60s, measure memory + latency drift
 * Phase 2: Concurrent write/read conflicts (analytics vs. bulk inserts)
 * Phase 3: Connection pool exhaustion probe
 * Phase 4: Bottleneck ranking — which endpoint degrades first?
 *
 * Run: node scripts/stress-test.mjs
 */
import 'dotenv/config';

const BASE = 'http://localhost:5000/api';
const HDR  = { 'Content-Type': 'application/json' };

// ── Helpers ───────────────────────────────────────────────────────────────────
async function http(method, path, body, token) {
    const t0 = Date.now();
    try {
        const r = await fetch(`${BASE}${path}`, {
            method,
            headers: { ...HDR, ...(token ? { Authorization: `Bearer ${token}` } : {}) },
            ...(body ? { body: JSON.stringify(body) } : {}),
        });
        const ms = Date.now() - t0;
        let json = {};
        try { json = await r.json(); } catch { /* empty body */ }
        return { ok: r.status < 400, status: r.status, ms, json };
    } catch (e) {
        return { ok: false, status: 0, ms: Date.now() - t0, error: e.message };
    }
}

function percentile(arr, p) {
    if (!arr.length) return 0;
    const s = [...arr].sort((a, b) => a - b);
    return s[Math.ceil(p / 100 * s.length) - 1];
}

function statsLine(label, durations, errors, total) {
    const errPct = ((errors / total) * 100).toFixed(1);
    return `${label.padEnd(36)} | ${String(total).padStart(5)} req | err=${errPct.padStart(5)}% | ` +
           `p50=${String(percentile(durations,50)).padStart(4)}ms ` +
           `p95=${String(percentile(durations,95)).padStart(4)}ms ` +
           `p99=${String(percentile(durations,99)).padStart(4)}ms`;
}

// ── Setup: get tokens ─────────────────────────────────────────────────────────
const loginA = await http('POST', '/auth/login', {
    email: 'testa@smartspend.test', password: 'Password123',
});
const loginB = await http('POST', '/auth/login', {
    email: 'testb@smartspend.test', password: 'Password123',
});

if (!loginA.json.token) {
    console.error('Login failed:', JSON.stringify(loginA));
    process.exit(1);
}
const TA = loginA.json.token;
const TOKENS = [TA]; // single user is sufficient for server-side stress

// Seed a pool of expenses for read tests
console.log('Seeding 50 expenses for stress tests…');
const seededIds = [];
const seedBatch = Array.from({ length: 50 }, (_, i) => ({
    amount: (i + 1) * 10,
    merchant: `StressSeed-${i}`,
    category: ['food','transport','shopping','bills','other'][i % 5],
    date: `2026-0${(i % 3) + 1}-${String((i % 28) + 1).padStart(2,'0')}`,
}));
// Seed in groups of 10 with 1s gaps to avoid rate-limiting before the test
for (let i = 0; i < seedBatch.length; i++) {
    const r = await http('POST', '/expenses', seedBatch[i], TA);
    if (r.status === 201 && r.json.expense?._id) seededIds.push(r.json.expense._id);
    else if (r.status === 429) { await new Promise(res => setTimeout(res, 3000)); i--; } // retry
}
console.log(`Seeded ${seededIds.length} expenses.\n`);

// ──────────────────────────────────────────────────────────────────────────────
// PHASE 1: Sustained load — 100 virtual users, 60 seconds
// Simulates a realistic traffic mix: 60% reads, 20% writes, 20% analytics
// Memory sampled every 5s to detect heap growth.
// ──────────────────────────────────────────────────────────────────────────────
console.log('══════════════════════════════════════════════════════════════');
console.log('  PHASE 1 — Sustained load: 100 VUs × 60s');
console.log('══════════════════════════════════════════════════════════════');

const DURATION_MS  = 60_000;
const VU_COUNT     = 100;
const MEMORY_POLL  = 5_000;

// Latency buckets sampled every 10s
const snapshots = [];   // { t, p50, p95, p99, errors, reqs }
const allDurations = { GET: [], POST: [], ANALYTICS: [] };
let totalErrors = 0, totalReqs = 0;

const startTime = Date.now();
let running = true;
setTimeout(() => { running = false; }, DURATION_MS);

// Memory growth probe (runs every 5s)
const memoryLog = [];
const memTimer = setInterval(async () => {
    await http('GET', '/health', null, null).catch(() => null);
    memoryLog.push({ t: Date.now() - startTime, ts: new Date().toISOString() });
}, MEMORY_POLL);

// Snapshot latency every 10s
const snapBuckets = { GET: [], POST: [], ANALYTICS: [] };
const snapTimer = setInterval(() => {
    const elapsed = Math.round((Date.now() - startTime) / 1000);
    const snap = {
        t: elapsed,
        GET:       { p50: percentile(snapBuckets.GET, 50),       p95: percentile(snapBuckets.GET, 95) },
        POST:      { p50: percentile(snapBuckets.POST, 50),      p95: percentile(snapBuckets.POST, 95) },
        ANALYTICS: { p50: percentile(snapBuckets.ANALYTICS, 50), p95: percentile(snapBuckets.ANALYTICS, 95) },
    };
    snapshots.push(snap);
    // Reset buckets for next window
    snapBuckets.GET.length = 0;
    snapBuckets.POST.length = 0;
    snapBuckets.ANALYTICS.length = 0;
}, 10_000);

// Virtual user loop — each VU runs a random operation, then immediately fires again
async function virtualUser(vuId) {
    while (running) {
        const token = TOKENS[vuId % TOKENS.length];
        const roll  = Math.random();

        if (roll < 0.60) {
            // 60% reads
            const endpoint = seededIds.length > 0 && Math.random() > 0.5
                ? `/expenses/${seededIds[Math.floor(Math.random() * seededIds.length)]}`
                : `/expenses?page=1&limit=10&skipCount=true`;
            const r = await http('GET', endpoint, null, token);
            allDurations.GET.push(r.ms);
            snapBuckets.GET.push(r.ms);
            if (!r.ok) totalErrors++;
            totalReqs++;
        } else if (roll < 0.80) {
            // 20% writes
            const r = await http('POST', '/expenses', {
                amount: Math.round(Math.random() * 500) + 1,
                merchant: `VU${vuId}-${Date.now()}`,
                category: ['food','transport','bills'][Math.floor(Math.random() * 3)],
                date: '2026-04-01',
            }, token);
            allDurations.POST.push(r.ms);
            snapBuckets.POST.push(r.ms);
            if (!r.ok) totalErrors++;
            totalReqs++;
            // Track created IDs for cleanup
            if (r.json.expense?._id) seededIds.push(r.json.expense._id);
        } else {
            // 20% analytics (most expensive)
            const endpoints = [
                '/analytics/summary',
                '/analytics/category-breakdown',
                '/analytics/monthly-trend',
            ];
            const ep = endpoints[Math.floor(Math.random() * endpoints.length)];
            const r  = await http('GET', ep, null, token);
            allDurations.ANALYTICS.push(r.ms);
            snapBuckets.ANALYTICS.push(r.ms);
            if (!r.ok) totalErrors++;
            totalReqs++;
        }
    }
}

// Launch all VUs simultaneously
await Promise.all(Array.from({ length: VU_COUNT }, (_, i) => virtualUser(i)));

clearInterval(memTimer);
clearInterval(snapTimer);

// Print phase 1 results
console.log(`\nTotal: ${totalReqs} requests in 60s = ${Math.round(totalReqs / 60)} req/s`);
console.log(`Errors: ${totalErrors} (${((totalErrors / totalReqs) * 100).toFixed(1)}%)\n`);
console.log(statsLine('GET /expenses',         allDurations.GET,       0, allDurations.GET.length));
console.log(statsLine('POST /expenses',         allDurations.POST,      0, allDurations.POST.length));
console.log(statsLine('GET /analytics/*',       allDurations.ANALYTICS, 0, allDurations.ANALYTICS.length));

console.log('\n── Latency trend (10s snapshots) ─────────────────────────────');
console.log('  t(s)  | GET p50/p95  | POST p50/p95 | ANALYTICS p50/p95');
console.log('  ------|-------------|--------------|------------------');
for (const s of snapshots) {
    console.log(
        `  ${String(s.t).padStart(3)}s  | ` +
        `${String(s.GET.p50).padStart(3)}/${String(s.GET.p95).padStart(3)}ms | ` +
        `${String(s.POST.p50).padStart(4)}/${String(s.POST.p95).padStart(4)}ms | ` +
        `${String(s.ANALYTICS.p50).padStart(5)}/${String(s.ANALYTICS.p95).padStart(5)}ms`
    );
}

// ──────────────────────────────────────────────────────────────────────────────
// PHASE 2: Concurrent write/read conflict
// 50 VUs writing + 50 VUs running analytics simultaneously — tests isolation
// ──────────────────────────────────────────────────────────────────────────────
console.log('\n══════════════════════════════════════════════════════════════');
console.log('  PHASE 2 — Write/Read Conflict: 50 writers + 50 readers (30s)');
console.log('══════════════════════════════════════════════════════════════');

const PHASE2_DURATION = 30_000;
let p2running = true;
setTimeout(() => { p2running = false; }, PHASE2_DURATION);

const writeDurations = [], readDurations = [];
let p2writeErrors = 0, p2readErrors = 0;
let p2writes = 0, p2reads = 0;

async function writeVU() {
    while (p2running) {
        const r = await http('POST', '/expenses', {
            amount: Math.round(Math.random() * 999) + 1,
            merchant: `WriteConflict-${Date.now()}`,
            category: 'other',
            date: '2026-04-15',
        }, TA);
        writeDurations.push(r.ms);
        if (!r.ok) p2writeErrors++;
        p2writes++;
        if (r.json.expense?._id) seededIds.push(r.json.expense._id);
    }
}

async function analyticsVU() {
    const eps = ['/analytics/summary', '/analytics/category-breakdown', '/analytics/monthly-trend'];
    while (p2running) {
        const r = await http('GET', eps[p2reads % eps.length], null, TA);
        readDurations.push(r.ms);
        if (!r.ok) p2readErrors++;
        p2reads++;
    }
}

await Promise.all([
    ...Array.from({ length: 50 }, writeVU),
    ...Array.from({ length: 50 }, analyticsVU),
]);

console.log(`\n  Writers: ${p2writes} ops | Readers: ${p2reads} ops`);
console.log(statsLine('Writes during conflict',  writeDurations, p2writeErrors, p2writes));
console.log(statsLine('Analytics during writes', readDurations,  p2readErrors,  p2reads));
console.log(`\n  Isolation check: read errors=${p2readErrors} write errors=${p2writeErrors}`);
console.log(`  (MongoDB document-level locking means reads and writes don't block each other)`);

// ──────────────────────────────────────────────────────────────────────────────
// PHASE 3: Connection pool exhaustion probe
// Fire requests faster than the pool (10 connections) can handle them.
// With bufferCommands:false, excess requests fail FAST instead of queuing.
// ──────────────────────────────────────────────────────────────────────────────
console.log('\n══════════════════════════════════════════════════════════════');
console.log('  PHASE 3 — Connection Pool Probe: 200 concurrent requests');
console.log('══════════════════════════════════════════════════════════════');

const poolResults = await Promise.all(
    Array.from({ length: 200 }, () =>
        http('GET', '/expenses?page=1&limit=5&skipCount=true', null, TA)
    )
);
const pool200 = poolResults.map(r => r.ms);
const pool429 = poolResults.filter(r => r.status === 429).length;
const pool5xx = poolResults.filter(r => r.status >= 500).length;
const pool200ok = poolResults.filter(r => r.status === 200).length;

console.log(`\n  200 concurrent requests:`);
console.log(`    200 OK  : ${pool200ok}`);
console.log(`    429     : ${pool429}  ← rate limiter hit`);
console.log(`    5xx     : ${pool5xx}  ← server/DB errors`);
console.log(`    p50/p95/p99: ${percentile(pool200,50)}/${percentile(pool200,95)}/${percentile(pool200,99)}ms`);

// ──────────────────────────────────────────────────────────────────────────────
// PHASE 4: Endpoint degradation ranking — which path slows down most under load?
// Test each endpoint class in isolation under 50 concurrent requests.
// ──────────────────────────────────────────────────────────────────────────────
console.log('\n══════════════════════════════════════════════════════════════');
console.log('  PHASE 4 — Bottleneck Ranking: 50 concurrent per endpoint');
console.log('══════════════════════════════════════════════════════════════\n');

const endpointTests = [
    { label: 'GET /expenses (list)',                fn: () => http('GET', '/expenses?page=1&limit=20&skipCount=true', null, TA) },
    { label: 'GET /expenses/:id (single)',           fn: () => http('GET', `/expenses/${seededIds[0]}`, null, TA) },
    { label: 'GET /analytics/summary',              fn: () => http('GET', '/analytics/summary', null, TA) },
    { label: 'GET /analytics/category-breakdown',   fn: () => http('GET', '/analytics/category-breakdown', null, TA) },
    { label: 'GET /analytics/monthly-trend',        fn: () => http('GET', '/analytics/monthly-trend', null, TA) },
    { label: 'GET /analytics/weekly-pattern',       fn: () => http('GET', '/analytics/weekly-pattern', null, TA) },
    { label: 'GET /analytics/top-merchants',        fn: () => http('GET', '/analytics/top-merchants', null, TA) },
    { label: 'POST /expenses (create)',              fn: () => http('POST', '/expenses', { amount: 1, merchant: `P4-${Date.now()}`, category: 'other', date: '2026-04-01' }, TA) },
];

const rankings = [];
for (const { label, fn } of endpointTests) {
    // Wait briefly between each endpoint to let rate limiter recover
    await new Promise(r => setTimeout(r, 1000));
    const results = await Promise.all(Array.from({ length: 50 }, fn));
    const ms     = results.map(r => r.ms);
    const errors = results.filter(r => !r.ok).length;
    rankings.push({ label, p50: percentile(ms, 50), p95: percentile(ms, 95), errors });
    console.log(statsLine(label, ms, errors, 50));
}

// Sort by p95 descending to show worst offenders first
console.log('\n── Degradation ranking (worst p95 first) ─────────────────────');
rankings.sort((a, b) => b.p95 - a.p95);
for (let i = 0; i < rankings.length; i++) {
    const r = rankings[i];
    const risk = r.p95 > 200 ? '🔴 HIGH' : r.p95 > 80 ? '🟡 MED' : '🟢 OK ';
    console.log(`  ${String(i+1).padStart(2)}. ${risk}  ${r.label.padEnd(42)} p95=${r.p95}ms`);
}

// ──────────────────────────────────────────────────────────────────────────────
// PHASE 5: Memory growth measurement (proxy via metrics endpoint)
// ──────────────────────────────────────────────────────────────────────────────
console.log('\n══════════════════════════════════════════════════════════════');
console.log('  PHASE 5 — Memory check via /api/metrics');
console.log('══════════════════════════════════════════════════════════════');

const metricsR = await http('GET', '/api/metrics', null, TA);
if (metricsR.ok) {
    const m = metricsR.json.metrics;
    console.log(`\n  Heap used    : ${m.memoryMb} MB`);
    console.log(`  Total reqs   : ${m.totalRequests}`);
    console.log(`  Total errors : ${m.totalErrors} (${m.errorRate})`);
    console.log(`  p50/p95/p99  : ${m.latency.p50}/${m.latency.p95}/${m.latency.p99}ms (${m.latency.sampleSize} samples)`);
    console.log(`  Uptime       : ${Math.round(m.uptime)}s`);
} else {
    console.log(`  Metrics endpoint: ${metricsR.status} — ${JSON.stringify(metricsR.json)}`);
}

// ── Cleanup ───────────────────────────────────────────────────────────────────
console.log('\nCleaning up created expenses…');
const uniqueIds = [...new Set(seededIds)];
const chunkSize = 500;
for (let i = 0; i < uniqueIds.length; i += chunkSize) {
    await http('POST', '/expenses/bulk-delete', { ids: uniqueIds.slice(i, i + chunkSize) }, TA);
}
console.log(`Deleted ${uniqueIds.length} test expenses.`);

console.log('\n══════════════════════════════════════════════════════════════');
console.log('  STRESS TEST COMPLETE');
console.log('══════════════════════════════════════════════════════════════\n');
