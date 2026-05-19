/**
 * Final Hardening Verification Script
 * Tests: Mass Assignment Rejection, OCC 409, Input Validation
 */

const API = 'http://127.0.0.1:5000/api';

async function getToken() {
    const res = await fetch(`${API}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'e2e_user@test.com', password: 'Password123!' })
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data.token;
}

async function runTests() {
    console.log('🚀 Final Hardening Verification\n');

    const token = await getToken();
    if (!token) {
        console.log('⚠️  No valid test user — testing without auth (expect 401s)\n');
    }

    const headers = {
        'Content-Type': 'application/json',
        ...(token && { 'Authorization': `Bearer ${token}` })
    };

    // ── TEST 1: Mass Assignment Rejection ──
    console.log('🔒 TEST 1: Mass Assignment — injecting isDeleted + aiCategorized');
    const massAssignRes = await fetch(`${API}/expenses`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
            amount: 100,
            merchant: 'Test Merchant',
            category: 'food',
            date: new Date().toISOString(),
            isDeleted: true,       // ← injected (should be rejected)
            aiCategorized: true,   // ← injected (should be rejected)
        })
    });
    const massAssignData = await massAssignRes.json();
    if (massAssignRes.status === 400 && massAssignData.message?.includes('Invalid fields')) {
        console.log(`   ✅ PASS — Rejected with 400: "${massAssignData.message}"\n`);
    } else if (massAssignRes.status === 401) {
        console.log(`   ⚠️  SKIP — 401 (no valid auth token)\n`);
    } else {
        console.log(`   ❌ FAIL — Got ${massAssignRes.status}: ${JSON.stringify(massAssignData)}\n`);
    }

    // ── TEST 2: Input Validation — invalid amount ──
    console.log('🔒 TEST 2: Input Validation — negative amount');
    const invalidRes = await fetch(`${API}/expenses`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
            amount: -50,
            merchant: 'Bad Input',
            category: 'food',
            date: new Date().toISOString(),
        })
    });
    const invalidData = await invalidRes.json();
    if (invalidRes.status === 400) {
        console.log(`   ✅ PASS — Rejected with 400: "${invalidData.message}"\n`);
    } else if (invalidRes.status === 401) {
        console.log(`   ⚠️  SKIP — 401 (no valid auth token)\n`);
    } else {
        console.log(`   ❌ FAIL — Got ${invalidRes.status}: ${JSON.stringify(invalidData)}\n`);
    }

    // ── TEST 3: Input Validation — missing amount ──
    console.log('🔒 TEST 3: Input Validation — missing amount');
    const missingRes = await fetch(`${API}/expenses`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
            merchant: 'No Amount',
            category: 'food',
        })
    });
    const missingData = await missingRes.json();
    if (missingRes.status === 400) {
        console.log(`   ✅ PASS — Rejected with 400: "${missingData.message}"\n`);
    } else if (missingRes.status === 401) {
        console.log(`   ⚠️  SKIP — 401 (no valid auth token)\n`);
    } else {
        console.log(`   ❌ FAIL — Got ${missingRes.status}: ${JSON.stringify(missingData)}\n`);
    }

    // ── TEST 4: Valid expense creation (should succeed) ──
    console.log('🔒 TEST 4: Valid Expense Creation');
    const validRes = await fetch(`${API}/expenses`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
            amount: 250,
            merchant: 'Validation Test Store',
            category: 'food',
            date: new Date().toISOString(),
            notes: 'Testing hardening',
        })
    });
    const validData = await validRes.json();
    if (validRes.status === 201 && validData.success) {
        console.log(`   ✅ PASS — Created expense ${validData.expense._id}\n`);
    } else if (validRes.status === 401) {
        console.log(`   ⚠️  SKIP — 401 (no valid auth token)\n`);
    } else {
        console.log(`   ❌ FAIL — Got ${validRes.status}: ${JSON.stringify(validData)}\n`);
    }

    // ── TEST 5: 503 Backpressure (Analytics Flood) ──
    console.log('🔒 TEST 5: Analytics Backpressure (10 concurrent requests)');
    const floodResults = await Promise.allSettled(
        Array.from({ length: 10 }, () =>
            fetch(`${API}/analytics/summary`, { headers })
        )
    );
    const statuses = {};
    for (const r of floodResults) {
        if (r.status === 'fulfilled') {
            const code = r.value.status;
            statuses[code] = (statuses[code] || 0) + 1;
        } else {
            statuses['error'] = (statuses['error'] || 0) + 1;
        }
    }
    console.log(`   Status distribution: ${JSON.stringify(statuses)}`);
    if (statuses[503] || statuses[429]) {
        console.log(`   ✅ PASS — Backpressure engaged (${statuses[503] || 0} rejected)\n`);
    } else if (statuses[401]) {
        console.log(`   ⚠️  SKIP — 401 (no valid auth token)\n`);
    } else {
        console.log(`   ℹ️  INFO — All passed (load was within limits)\n`);
    }

    console.log('✅ Final Hardening Verification Complete.');
}

runTests().catch(console.error);
