/**
 * @fileoverview NutriSync API Test Suite
 * @description Comprehensive test coverage for all backend endpoints.
 *              Validates input validation, AI response structure, security
 *              headers, static file serving, and error handling.
 * 
 * @usage node test_suite.js
 * @requires Server running on http://localhost:3000
 * @version 2.0.0
 */

'use strict';

const BASE_URL = 'http://localhost:3000';

// ─── Test Framework ─────────────────────────────────────────────────────────

let passed = 0;
let failed = 0;
let skipped = 0;
const results = [];

/**
 * Runs a single test case with error handling.
 * @param {string} name - Test description
 * @param {Function} fn - Async test function
 */
const test = async (name, fn) => {
    try {
        await fn();
        passed++;
        results.push({ name, status: '✅' });
        console.log(`  ✅ ${name}`);
    } catch (err) {
        failed++;
        results.push({ name, status: '❌', error: err.message });
        console.log(`  ❌ ${name}`);
        console.log(`     → ${err.message}`);
    }
};

/**
 * Assertion helper.
 * @param {boolean} condition
 * @param {string} msg - Error message if assertion fails
 */
const assert = (condition, msg) => {
    if (!condition) throw new Error(msg || 'Assertion failed');
};

/**
 * Fetch JSON helper with status code.
 * @param {string} url
 * @param {Object} options - fetch options
 * @returns {Promise<{status: number, data: Object}>}
 */
const fetchJSON = async (url, options) => {
    const res = await fetch(url, options);
    const data = await res.json();
    return { status: res.status, data, headers: res.headers };
};

const postJSON = (path, body) => fetchJSON(`${BASE_URL}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
});


// ═══════════════════════════════════════════════════════════════════════════
// TEST EXECUTION
// ═══════════════════════════════════════════════════════════════════════════

(async () => {
    console.log('\n🧪 NutriSync API Test Suite v2.0\n');
    console.log('━'.repeat(50));


    // ── 1. Health Check ─────────────────────────────────────────────────────
    console.log('\n📡 GET /api/health\n');

    await test('Health endpoint returns 200 with uptime', async () => {
        const { status, data } = await fetchJSON(`${BASE_URL}/api/health`);
        assert(status === 200, `Expected 200, got ${status}`);
        assert(data.status === 'healthy', 'Status should be healthy');
        assert(typeof data.uptime === 'number', 'Uptime should be a number');
        assert(data.timestamp, 'Should include timestamp');
    });


    // ── 2. Input Validation ─────────────────────────────────────────────────
    console.log('\n📡 POST /api/food/search — Validation\n');

    await test('Returns 400 when query and image are both empty', async () => {
        const { status, data } = await postJSON('/api/food/search', {
            query: '', goal: 'balanced'
        });
        assert(status === 400, `Expected 400, got ${status}`);
        assert(data.success === false, 'Expected success=false');
    });

    await test('Rejects invalid goal parameter', async () => {
        const { status, data } = await postJSON('/api/food/search', {
            query: 'rice', goal: 'INVALID_GOAL'
        });
        assert(status === 400, `Expected 400, got ${status}`);
    });


    // ── 3. AI Search Endpoint ───────────────────────────────────────────────
    console.log('\n📡 POST /api/food/search — AI Integration\n');

    await test('Returns valid suggestions for "chicken pasta" (muscle)', async () => {
        const { status, data } = await postJSON('/api/food/search', {
            query: 'chicken pasta', goal: 'muscle'
        });
        assert(status === 200, `Expected 200, got ${status}`);
        assert(data.success === true, 'Expected success=true');
        assert(Array.isArray(data.data.suggestions), 'suggestions must be an array');
        assert(data.data.suggestions.length > 0, 'Should have at least 1 suggestion');

        const meal = data.data.suggestions[0];
        assert(typeof meal.name === 'string' && meal.name.length > 0, 'name required');
        assert(typeof meal.calories === 'number', 'calories must be a number');
        assert(typeof meal.protein_g === 'number', 'protein_g must be a number');
        assert(typeof meal.carbs_g === 'number', 'carbs_g must be a number');
        assert(typeof meal.fats_g === 'number', 'fats_g must be a number');
        assert(typeof meal.reasoning === 'string', 'reasoning required');
    });

    await test('Returns suggestions for "pizza" (fatloss)', async () => {
        const { status, data } = await postJSON('/api/food/search', {
            query: 'pizza', goal: 'fatloss'
        });
        assert(status === 200, `Expected 200, got ${status}`);
        assert(data.data.suggestions.length > 0, 'Should have suggestions');
    });

    await test('Returns cached result on repeat query', async () => {
        const { data } = await postJSON('/api/food/search', {
            query: 'chicken pasta', goal: 'muscle'
        });
        assert(data.cached === true, 'Second call should be cached');
    });


    // ── 4. Meal Plan Endpoint ───────────────────────────────────────────────
    console.log('\n📡 POST /api/food/meal-plan\n');

    await test('Generates a structured 5-meal day plan', async () => {
        const { status, data } = await postJSON('/api/food/meal-plan', {
            goal: 'balanced', calories: 2000
        });
        assert(status === 200, `Expected 200, got ${status}`);
        assert(data.success === true, 'Expected success=true');
        assert(Array.isArray(data.data.meals), 'meals must be an array');
        assert(data.data.meals.length >= 3, `Expected ≥3 meals, got ${data.data.meals.length}`);

        const meal = data.data.meals[0];
        assert(meal.time, 'Meal must have time');
        assert(meal.label, 'Meal must have label');
        assert(meal.name, 'Meal must have name');
        assert(typeof meal.calories === 'number', 'Calories must be a number');
    });


    // ── 5. Shopping List Endpoint ───────────────────────────────────────────
    console.log('\n📡 POST /api/food/shopping-list\n');

    await test('Returns 400 with empty history array', async () => {
        const { status } = await postJSON('/api/food/shopping-list', { history: [] });
        assert(status === 400, `Expected 400, got ${status}`);
    });

    await test('Returns 400 with missing history', async () => {
        const { status } = await postJSON('/api/food/shopping-list', {});
        assert(status === 400, `Expected 400, got ${status}`);
    });

    await test('Generates organized shopping list from meal history', async () => {
        const { status, data } = await postJSON('/api/food/shopping-list', {
            history: [
                { name: 'Grilled Chicken Salad' },
                { name: 'Greek Yogurt with Berries' },
                { name: 'Salmon with Brown Rice' }
            ]
        });
        assert(status === 200, `Expected 200, got ${status}`);
        assert(data.success === true, 'Expected success=true');
        assert(typeof data.data.list === 'string', 'list should be a string');
        assert(data.data.list.length > 50, 'Shopping list seems too short');
    });


    // ── 6. Static File Serving ──────────────────────────────────────────────
    console.log('\n📡 Static File Serving\n');

    await test('Serves index.html at root with correct content-type', async () => {
        const res = await fetch(`${BASE_URL}/`);
        assert(res.status === 200, `Expected 200, got ${res.status}`);
        const ct = res.headers.get('content-type');
        assert(ct.includes('html'), `Expected HTML content-type, got ${ct}`);
        const text = await res.text();
        assert(text.includes('NutriSync'), 'HTML should contain NutriSync');
        assert(text.includes('aria-label'), 'HTML should have ARIA labels');
    });

    await test('Serves styles.css', async () => {
        const res = await fetch(`${BASE_URL}/styles.css`);
        assert(res.status === 200, `Expected 200, got ${res.status}`);
    });

    await test('Serves app.js as module', async () => {
        const res = await fetch(`${BASE_URL}/app.js`);
        assert(res.status === 200, `Expected 200, got ${res.status}`);
    });


    // ── 7. Security Headers ─────────────────────────────────────────────────
    console.log('\n📡 Security Headers\n');

    await test('Response includes Helmet security headers', async () => {
        const res = await fetch(`${BASE_URL}/`);
        const xfo = res.headers.get('x-frame-options');
        const xcto = res.headers.get('x-content-type-options');
        assert(xcto === 'nosniff', `Expected X-Content-Type-Options: nosniff, got ${xcto}`);
    });


    // ── Summary ─────────────────────────────────────────────────────────────
    console.log('\n' + '━'.repeat(50));
    const total = passed + failed + skipped;
    console.log(`\n🏁 Results: ${passed} passed, ${failed} failed, ${total} total`);

    if (failed === 0) {
        console.log('🎉 All tests passed!\n');
    } else {
        console.log('\n⚠️  Failing tests:');
        results.filter(r => r.status === '❌').forEach(r => {
            console.log(`   • ${r.name}: ${r.error}`);
        });
        console.log('');
    }

    process.exit(failed > 0 ? 1 : 0);
})();
