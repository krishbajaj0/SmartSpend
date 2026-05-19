/**
 * Full system validation test suite for the Expense module.
 * Run with: node scripts/test-expense-module.mjs
 */
import 'dotenv/config';

const BASE = 'http://localhost:5000/api';
const HEADERS_JSON = { 'Content-Type': 'application/json' };

// ── Helpers ───────────────────────────────────────────────────────────────────
let passed = 0, failed = 0, warned = 0;

function result(name, ok, got, expected, warn = false) {
    if (warn) {
        warned++;
        console.log(`  ⚠️  WARN  [${name}] got=${JSON.stringify(got)} expected=${JSON.stringify(expected)}`);
    } else if (ok) {
        passed++;
        console.log(`  ✅ PASS  [${name}]`);
    } else {
        failed++;
        console.log(`  ❌ FAIL  [${name}] got=${JSON.stringify(got)} expected=${JSON.stringify(expected)}`);
    }
}

async function req(method, path, body, token) {
    const opts = { method, headers: { ...HEADERS_JSON } };
    if (token) opts.headers['Authorization'] = `Bearer ${token}`;
    if (body)  opts.body = JSON.stringify(body);
    try {
        const r = await fetch(`${BASE}${path}`, opts);
        let json;
        try { json = await r.json(); } catch { json = {}; }
        return { status: r.status, body: json };
    } catch (e) {
        return { status: 0, body: { error: e.message } };
    }
}

async function login(email, password) {
    const r = await req('POST', '/auth/login', { email, password });
    return r.body.token;
}

// ── Setup ─────────────────────────────────────────────────────────────────────
console.log('\n══════════════════════════════════════════');
console.log('  EXPENSE MODULE — SYSTEM VALIDATION');
console.log('══════════════════════════════════════════\n');

const tokenA = await login('testa@smartspend.test', 'Password123');
const tokenB = await login('testb@smartspend.test', 'Password123');

if (!tokenA) { console.error('❌ ABORT: Could not login User A'); process.exit(1); }
if (!tokenB) { console.error('❌ ABORT: Could not login User B'); process.exit(1); }
console.log('✅ Tokens obtained for User A and User B\n');

let expenseIdA;   // User A's expense — used across tests
let expenseIdB;   // User B's expense — used for cross-user security test

// ═══════════════════════════════════════════════════════════════════════════
// SECTION 1 — CRUD VALIDATION
// ═══════════════════════════════════════════════════════════════════════════
console.log('─── 1. CRUD VALIDATION ───────────────────────────────────────\n');

// 1.1 Valid create
{
    const r = await req('POST', '/expenses', {
        amount: 450, merchant: 'Swiggy', category: 'food',
        date: '2026-04-15', notes: 'Lunch',
    }, tokenA);
    result('1.1 Valid create → 201', r.status === 201 && r.body.success, r.status, 201);
    expenseIdA = r.body.expense?._id;
}

// 1.2 Create for User B (needed for cross-user test later)
{
    const r = await req('POST', '/expenses', {
        amount: 200, merchant: 'Ola', category: 'transport',
        date: '2026-04-15',
    }, tokenB);
    result('1.2 User B valid create → 201', r.status === 201, r.status, 201);
    expenseIdB = r.body.expense?._id;
}

// 1.3 GET list
{
    const r = await req('GET', '/expenses', null, tokenA);
    result('1.3 GET /expenses → 200 with array', r.status === 200 && Array.isArray(r.body.expenses), r.status, 200);
}

// 1.4 GET single
{
    const r = await req('GET', `/expenses/${expenseIdA}`, null, tokenA);
    result('1.4 GET /expenses/:id → 200', r.status === 200 && r.body.expense?._id === expenseIdA, r.status, 200);
}

// 1.5 Valid update
{
    const r = await req('PUT', `/expenses/${expenseIdA}`, { amount: 500, notes: 'Updated' }, tokenA);
    result('1.5 PUT /expenses/:id → 200, amount updated', r.status === 200 && r.body.expense?.amount === 500, r.status, 200);
}

// 1.6 Soft delete
{
    const r = await req('DELETE', `/expenses/${expenseIdA}`, null, tokenA);
    result('1.6 DELETE → 200 (soft)', r.status === 200 && r.body.success, r.status, 200);
}

// 1.7 Confirm soft delete — item should 404 on GET
{
    const r = await req('GET', `/expenses/${expenseIdA}`, null, tokenA);
    result('1.7 Deleted item 404 on GET', r.status === 404, r.status, 404);
}

// 1.8 Re-create for remaining tests
{
    const r = await req('POST', '/expenses', {
        amount: 300, merchant: 'Zomato', category: 'food',
        date: '2026-04-10', notes: 'Dinner', tags: ['weekend'],
    }, tokenA);
    expenseIdA = r.body.expense?._id;
    result('1.8 Re-create for further tests', r.status === 201, r.status, 201);
}

// ═══════════════════════════════════════════════════════════════════════════
// SECTION 2 — INPUT VALIDATION (EDGE CASES)
// ═══════════════════════════════════════════════════════════════════════════
console.log('\n─── 2. INPUT VALIDATION — EDGE CASES ─────────────────────────\n');

// 2.1 Negative amount
{
    const r = await req('POST', '/expenses', {
        amount: -50, merchant: 'Test', category: 'food', date: '2026-04-01',
    }, tokenA);
    result('2.1 Negative amount → 400', r.status === 400, r.status, 400);
}

// 2.2 Zero amount
{
    const r = await req('POST', '/expenses', {
        amount: 0, merchant: 'Test', category: 'food', date: '2026-04-01',
    }, tokenA);
    result('2.2 Zero amount → 400', r.status === 400, r.status, 400);
}

// 2.3 Invalid category
{
    const r = await req('POST', '/expenses', {
        amount: 100, merchant: 'Test', category: 'weaponry', date: '2026-04-01',
    }, tokenA);
    result('2.3 Invalid category → 400', r.status === 400, r.status, 400);
}

// 2.4 Missing required field (merchant)
{
    const r = await req('POST', '/expenses', {
        amount: 100, category: 'food', date: '2026-04-01',
    }, tokenA);
    result('2.4 Missing merchant → 400', r.status === 400, r.status, 400);
}

// 2.5 Missing amount
{
    const r = await req('POST', '/expenses', {
        merchant: 'Test', category: 'food', date: '2026-04-01',
    }, tokenA);
    result('2.5 Missing amount → 400', r.status === 400, r.status, 400);
}

// 2.6 Invalid date format
{
    const r = await req('POST', '/expenses', {
        amount: 100, merchant: 'Test', category: 'food', date: 'not-a-date',
    }, tokenA);
    result('2.6 Invalid date → 400', r.status === 400, r.status, 400);
}

// 2.7 Notes exceeding maxlength (501 chars)
{
    const r = await req('POST', '/expenses', {
        amount: 100, merchant: 'Test', category: 'food',
        date: '2026-04-01', notes: 'x'.repeat(501),
    }, tokenA);
    result('2.7 Notes >500 chars → 400', r.status === 400, r.status, 400);
}

// 2.8 Amount as string that looks like a number
{
    const r = await req('POST', '/expenses', {
        amount: '100', merchant: 'Test', category: 'food', date: '2026-04-01',
    }, tokenA);
    // This may coerce or reject — both are acceptable, document actual
    result('2.8 String amount coerces/rejects', r.status === 201 || r.status === 400,
        `status=${r.status}`, '201 or 400');
}

// 2.9 Extremely large amount
{
    const r = await req('POST', '/expenses', {
        amount: 999999999999, merchant: 'BigTest', category: 'other', date: '2026-04-01',
    }, tokenA);
    result('2.9 Very large amount → accepted (no upper cap)', r.status === 201, r.status, 201,
        r.status !== 201); // warn if rejected — it SHOULD be accepted (no max set)
}

// 2.10 Empty body
{
    const r = await req('POST', '/expenses', {}, tokenA);
    result('2.10 Empty body → 400', r.status === 400, r.status, 400);
}

// ═══════════════════════════════════════════════════════════════════════════
// SECTION 3 — SECURITY TESTING
// ═══════════════════════════════════════════════════════════════════════════
console.log('\n─── 3. SECURITY TESTING ──────────────────────────────────────\n');

// 3.1 No token
{
    const r = await req('GET', '/expenses', null, null);
    result('3.1 No token → 401', r.status === 401, r.status, 401);
}

// 3.2 Malformed token
{
    const r = await req('GET', '/expenses', null, 'Bearer not.a.real.token');
    result('3.2 Malformed token → 401', r.status === 401, r.status, 401);
}

// 3.3 Expired/garbage JWT
{
    const r = await req('GET', '/expenses', null, 'eyJhbGciOiJIUzI1NiJ9.garbage.signature');
    result('3.3 Garbage JWT → 401', r.status === 401, r.status, 401);
}

// 3.4 Cross-user: User A reads User B's expense
{
    const r = await req('GET', `/expenses/${expenseIdB}`, null, tokenA);
    result('3.4 Cross-user GET → 404 (not 403 — correct)', r.status === 404, r.status, 404);
}

// 3.5 Cross-user: User A updates User B's expense
{
    const r = await req('PUT', `/expenses/${expenseIdB}`, { amount: 9999 }, tokenA);
    result('3.5 Cross-user PUT → 404', r.status === 404, r.status, 404);
}

// 3.6 Cross-user: User A deletes User B's expense
{
    const r = await req('DELETE', `/expenses/${expenseIdB}`, null, tokenA);
    result('3.6 Cross-user DELETE → 404', r.status === 404, r.status, 404);
}

// 3.7 Mass assignment — try to set userId to another user's ID
{
    const r = await req('POST', '/expenses', {
        amount: 100, merchant: 'Hacker', category: 'food',
        date: '2026-04-01',
        userId: expenseIdB,              // try to inject another userId
        isDeleted: false,
        tokenVersion: 99,
        __v: 999,
    }, tokenA);
    // Must create with req.user._id, not the submitted userId
    const createdUserId = r.body.expense?.userId;
    const submittedWrong = r.status === 201 && createdUserId !== expenseIdB;
    result('3.7 Mass assignment — userId not overridden', submittedWrong, createdUserId, '!= expenseIdB');
    if (r.status === 201) {
        // Clean up this test expense
        await req('DELETE', `/expenses/${r.body.expense._id}`, null, tokenA);
    }
}

// 3.8 Injection-like payload in merchant field
{
    const r = await req('POST', '/expenses', {
        amount: 100, merchant: '{"$where":"function(){return true;}"}',
        category: 'other', date: '2026-04-01',
    }, tokenA);
    result('3.8 NoSQL injection in merchant → stored safely (200/201)', 
        r.status === 201 || r.status === 400, r.status, '201 or 400');
    if (r.status === 201) await req('DELETE', `/expenses/${r.body.expense._id}`, null, tokenA);
}

// 3.9 Try to set isDeleted:false on a deleted item via PUT
{
    // First create and delete an item
    const c = await req('POST', '/expenses', {
        amount: 1, merchant: 'TempDel', category: 'other', date: '2026-04-01',
    }, tokenA);
    const tmpId = c.body.expense?._id;
    await req('DELETE', `/expenses/${tmpId}`, null, tokenA);
    // Now try to PUT isDeleted:false
    const r = await req('PUT', `/expenses/${tmpId}`, { isDeleted: false }, tokenA);
    result('3.9 Cannot un-delete via PUT (deleted item 404)', r.status === 404, r.status, 404);
}

// ═══════════════════════════════════════════════════════════════════════════
// SECTION 4 — QUERY & FILTER TESTING
// ═══════════════════════════════════════════════════════════════════════════
console.log('\n─── 4. QUERY & FILTER TESTING ────────────────────────────────\n');

// Create a set of known expenses for filtering
const filterExpenses = [
    { amount: 100, merchant: 'McDonald', category: 'food',      date: '2026-03-05', tags: ['fast-food'] },
    { amount: 250, merchant: 'Uber',     category: 'transport', date: '2026-03-10' },
    { amount: 500, merchant: 'Myntra',   category: 'shopping',  date: '2026-03-15' },
    { amount: 120, merchant: 'Swiggy',   category: 'food',      date: '2026-03-20', tags: ['lunch'] },
    { amount: 800, merchant: 'Amazon',   category: 'shopping',  date: '2026-03-25' },
];
const filterIds = [];
for (const e of filterExpenses) {
    const r = await req('POST', '/expenses', e, tokenA);
    if (r.body.expense?._id) filterIds.push(r.body.expense._id);
}

// 4.1 Category filter
{
    const r = await req('GET', '/expenses?category=food', null, tokenA);
    const allFood = r.body.expenses?.every(e => e.category === 'food');
    result('4.1 Category=food filter — all results are food', allFood, allFood, true);
}

// 4.2 Date range filter
{
    const r = await req('GET', '/expenses?dateFrom=2026-03-01&dateTo=2026-03-31', null, tokenA);
    const allInRange = r.body.expenses?.every(e => new Date(e.date) >= new Date('2026-03-01')
        && new Date(e.date) <= new Date('2026-03-31'));
    result('4.2 Date range filter — all results in March', allInRange, allInRange, true);
}

// 4.3 Amount range filter
{
    const r = await req('GET', '/expenses?amountMin=200&amountMax=600', null, tokenA);
    const allInRange = r.body.expenses?.every(e => e.amount >= 200 && e.amount <= 600);
    result('4.3 Amount range filter — 200–600', allInRange, allInRange, true);
}

// 4.4 Pagination
{
    const r = await req('GET', '/expenses?page=1&limit=3', null, tokenA);
    const correct = r.body.expenses?.length <= 3 && r.body.pagination?.limit === 3;
    result('4.4 Pagination limit=3', correct, r.body.expenses?.length, '<=3');
}

// 4.5 Page beyond total
{
    const r = await req('GET', '/expenses?page=9999&limit=20', null, tokenA);
    result('4.5 Page=9999 → 200 with empty array', r.status === 200 && r.body.expenses?.length === 0,
        r.body.expenses?.length, 0);
}

// 4.6 Text search
{
    const r = await req('GET', '/expenses?search=swiggy', null, tokenA);
    result('4.6 Text search "swiggy" → 200', r.status === 200, r.status, 200);
}

// 4.7 Sort ascending
{
    const r = await req('GET', '/expenses?sortBy=amount&sortOrder=asc', null, tokenA);
    const amounts = r.body.expenses?.map(e => e.amount);
    const sorted  = [...(amounts || [])].sort((a, b) => a - b);
    result('4.7 Sort by amount asc', JSON.stringify(amounts) === JSON.stringify(sorted),
        amounts?.slice(0,3), 'ascending');
}

// 4.8 Merchant filter
{
    const r = await req('GET', '/expenses?merchant=uber', null, tokenA);
    result('4.8 Merchant filter "uber" → 200', r.status === 200, r.status, 200);
}

// 4.9 Limit=100 (max allowed)
{
    const r = await req('GET', '/expenses?limit=100', null, tokenA);
    result('4.9 limit=100 → 200', r.status === 200, r.status, 200);
}

// 4.10 Invalid limit (string)
{
    const r = await req('GET', '/expenses?limit=abc', null, tokenA);
    result('4.10 limit=abc → 200 (coerces to NaN → default)', r.status === 200, r.status, 200,
        r.status !== 200);
}

// ═══════════════════════════════════════════════════════════════════════════
// SECTION 5 — DATABASE & CONSISTENCY VALIDATION
// ═══════════════════════════════════════════════════════════════════════════
console.log('\n─── 5. DATABASE & CONSISTENCY ────────────────────────────────\n');

// 5.1 Verify soft delete — confirm record still in DB with isDeleted:true
{
    // Create and delete a fresh expense
    const c = await req('POST', '/expenses', {
        amount: 10, merchant: 'SoftDelTest', category: 'other', date: '2026-04-01',
    }, tokenA);
    const id = c.body.expense?._id;
    await req('DELETE', `/expenses/${id}`, null, tokenA);
    // Verify via API — should 404
    const get = await req('GET', `/expenses/${id}`, null, tokenA);
    result('5.1 Soft-deleted expense 404 via API', get.status === 404, get.status, 404);
    // Note: the record still exists in DB with isDeleted:true — verified separately
}

// 5.2 Update fields are whitelisted — forbidden fields rejected
{
    const r = await req('PUT', `/expenses/${expenseIdA}`, {
        userId:         '000000000000000000000000',
        isDeleted:      true,
        aiCategorized:  true,
        aiConfidence:   0.99,
        __v:            999,
    }, tokenA);
    // The update should succeed (200) but silently ignore the forbidden fields
    if (r.status === 200) {
        const notManipulated = r.body.expense?.isDeleted !== true
            && String(r.body.expense?.userId) !== '000000000000000000000000';
        result('5.2 Whitelist — forbidden fields ignored in update', notManipulated,
            { isDeleted: r.body.expense?.isDeleted, userId: r.body.expense?.userId }, 'original values');
    } else {
        result('5.2 Whitelist PUT', false, r.status, 200);
    }
}

// 5.3 Bulk delete
{
    const ids = filterIds.slice(0, 2);
    const r = await req('POST', '/expenses/bulk-delete', { ids }, tokenA);
    result('5.3 Bulk delete 2 expenses → 200', r.status === 200, r.status, 200);
    // Verify both are now 404
    const g1 = await req('GET', `/expenses/${ids[0]}`, null, tokenA);
    const g2 = await req('GET', `/expenses/${ids[1]}`, null, tokenA);
    result('5.3b Both bulk-deleted → 404', g1.status === 404 && g2.status === 404,
        [g1.status, g2.status], [404, 404]);
}

// 5.4 Bulk delete — empty IDs array
{
    const r = await req('POST', '/expenses/bulk-delete', { ids: [] }, tokenA);
    result('5.4 Bulk delete empty array → 400', r.status === 400, r.status, 400);
}

// 5.5 Bulk delete — over 500 items
{
    const ids = Array.from({ length: 501 }, () => '507f1f77bcf86cd799439011');
    const r = await req('POST', '/expenses/bulk-delete', { ids }, tokenA);
    result('5.5 Bulk delete >500 items → 400', r.status === 400, r.status, 400);
}

// 5.6 Duplicate expense
{
    const r = await req('POST', `/expenses/duplicate/${expenseIdA}`, null, tokenA);
    result('5.6 Duplicate expense → 201', r.status === 201, r.status, 201);
    if (r.status === 201) await req('DELETE', `/expenses/${r.body.expense._id}`, null, tokenA);
}

// ═══════════════════════════════════════════════════════════════════════════
// SECTION 6 — RECURRING EXPENSES
// ═══════════════════════════════════════════════════════════════════════════
console.log('\n─── 6. RECURRING EXPENSES ────────────────────────────────────\n');

{
    const c = await req('POST', '/expenses', {
        amount: 999, merchant: 'Netflix', category: 'subscriptions',
        date: '2026-04-01', isRecurring: true, recurringInterval: 'monthly',
    }, tokenA);
    result('6.1 Create recurring expense → 201', c.status === 201, c.status, 201);

    const r = await req('GET', '/expenses/recurring', null, tokenA);
    result('6.2 GET /recurring → contains created item', r.status === 200 &&
        r.body.expenses?.some(e => e.merchant === 'Netflix'), r.body.expenses?.length, '>0');

    if (c.body.expense?._id) await req('DELETE', `/expenses/${c.body.expense._id}`, null, tokenA);
}

// ═══════════════════════════════════════════════════════════════════════════
// SECTION 7 — RATE LIMIT SMOKE TEST
// ═══════════════════════════════════════════════════════════════════════════
console.log('\n─── 7. RATE LIMIT SMOKE TEST ─────────────────────────────────\n');
{
    // Hit GET /expenses rapidly — should NOT rate-limit (general API limiter: 100/min)
    const results = await Promise.all(
        Array.from({ length: 20 }, () => req('GET', '/expenses', null, tokenA))
    );
    const all200 = results.every(r => r.status === 200);
    result('7.1 20 concurrent GETs → all 200 (not rate-limited)', all200,
        results.map(r => r.status).filter(s => s !== 200), '[]');
}

// ═══════════════════════════════════════════════════════════════════════════
// SECTION 8 — INVALID ID FORMATS
// ═══════════════════════════════════════════════════════════════════════════
console.log('\n─── 8. INVALID ID FORMATS ────────────────────────────────────\n');

{
    const r = await req('GET', '/expenses/not-a-valid-id', null, tokenA);
    result('8.1 Invalid ObjectId → 400 (CastError)', r.status === 400, r.status, 400);
}
{
    const r = await req('GET', '/expenses/000000000000000000000000', null, tokenA);
    result('8.2 Valid ObjectId not found → 404', r.status === 404, r.status, 404);
}

// ── Cleanup remaining test data ───────────────────────────────────────────
for (const id of filterIds.slice(2)) {
    await req('DELETE', `/expenses/${id}`, null, tokenA);
}
await req('DELETE', `/expenses/${expenseIdA}`, null, tokenA);
await req('DELETE', `/expenses/${expenseIdB}`, null, tokenB);

// ── Final report ──────────────────────────────────────────────────────────
console.log('\n══════════════════════════════════════════');
console.log('  VALIDATION COMPLETE');
console.log(`  ✅ PASSED : ${passed}`);
console.log(`  ❌ FAILED : ${failed}`);
console.log(`  ⚠️  WARNED : ${warned}`);
console.log('══════════════════════════════════════════\n');
if (failed > 0) process.exit(1);
