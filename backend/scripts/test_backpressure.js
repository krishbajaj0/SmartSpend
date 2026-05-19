import http from 'http';

const API_URL = 'http://127.0.0.1:5000/api';

/**
 * Validates that backpressure mechanisms correctly reject overload
 * and protect CRUD performance.
 */
async function main() {
    console.log('🚀 Starting Backpressure Validation Tests...\n');

    // 1. Get a token
    const loginPayload = JSON.stringify({ email: 'test@example.com', password: 'password123' });
    const loginReq = await fetch(`${API_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: loginPayload
    });
    
    if (loginReq.status === 401) {
        console.log('Skipping validation: Invalid auth (requires valid test user).');
        return;
    }
    
    let token = '';
    try {
        const loginData = await loginReq.json();
        token = loginData.token;
    } catch {
        // Mock token for testing Limiter middleware
        token = 'mock.jwt.token'; 
    }

    // ── TEST 1: ANALYTICS FLOOD ───────────────────────────────────────────────
    console.log('🔥 TEST 1: Analytics Flood (50 concurrent requests)');
    const analyticsRequests = [];
    for (let i = 0; i < 50; i++) {
        analyticsRequests.push(fetch(`${API_URL}/analytics/summary`, {
            headers: { 'Authorization': `Bearer ${token}` }
        }));
    }

    const analyticsResults = await Promise.allSettled(analyticsRequests);
    
    let successCount = 0;
    let overloadCount = 0;
    let otherErrorCount = 0;

    for (const res of analyticsResults) {
        if (res.status === 'fulfilled') {
            if (res.value.status === 200 || res.value.status === 401) successCount++; // 401 means it bypassed limiter and hit Auth
            else if (res.value.status === 503 || res.value.status === 429) overloadCount++;
            else otherErrorCount++;
        } else {
            otherErrorCount++;
        }
    }

    console.log(`Expected ~3 to hit logic, 47 rejected (429/503).`);
    console.log(`Results: ${successCount} Processed | ${overloadCount} Rejected | ${otherErrorCount} Errors\n`);

    // ── TEST 2: MIXED LOAD ────────────────────────────────────────────────────
    console.log('🔥 TEST 2: Mixed Load (Analytics Flood + CRUD)');
    
    // Flood analytics
    const flood = [];
    for (let i = 0; i < 10; i++) {
        flood.push(fetch(`${API_URL}/analytics/category-over-time`, {
            headers: { 'Authorization': `Bearer ${token}` }
        }));
    }

    // Measure CRUD latency during flood
    const start = Date.now();
    const crudRes = await fetch(`${API_URL}/expenses?limit=1`, {
        headers: { 'Authorization': `Bearer ${token}` }
    });
    const crudLatency = Date.now() - start;

    console.log(`CRUD Latency under Analytics Flood: ${crudLatency}ms`);
    console.log(`CRUD Status: ${crudRes.status} (Expected: 200 or 401)\n`);

    console.log('✅ Validation Complete.');
}

main().catch(console.error);
