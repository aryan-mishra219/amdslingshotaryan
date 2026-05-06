/**
 * NutriSync API Test Suite
 * Run: node test.js
 * 
 * Tests all backend endpoints to verify the Groq AI integration,
 * input validation, and response structure.
 */

const BASE = 'http://localhost:3000';
let passed = 0;
let failed = 0;

const test = async (name, fn) => {
    try {
        await fn();
        passed++;
        console.log(`  ✅ ${name}`);
    } catch (err) {
        failed++;
        console.log(`  ❌ ${name}`);
        console.log(`     → ${err.message}`);
    }
};

const assert = (condition, msg) => {
    if (!condition) throw new Error(msg || 'Assertion failed');
};

const fetchJSON = async (url, options) => {
    const res = await fetch(url, options);
    const data = await res.json();
    return { status: res.status, data };
};

(async () => {
    console.log('\n🧪 NutriSync API Test Suite\n');
    console.log('━'.repeat(45));

    // ── Endpoint: /api/food/search ──────────────────
    console.log('\n📡 POST /api/food/search\n');

    await test('Returns 400 when no query or image provided', async () => {
        const { status, data } = await fetchJSON(`${BASE}/api/food/search`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ query: '', goal: 'balanced' })
        });
        assert(status === 400, `Expected 400, got ${status}`);
        assert(data.success === false, 'Expected success=false');
    });

    await test('Returns valid AI suggestions for text query', async () => {
        const { status, data } = await fetchJSON(`${BASE}/api/food/search`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ query: 'chicken pasta', goal: 'muscle' })
        });
        assert(status === 200, `Expected 200, got ${status}`);
        assert(data.success === true, 'Expected success=true');
        assert(data.data.suggestions, 'Missing suggestions array');
        assert(data.data.suggestions.length > 0, 'Suggestions array is empty');

        const meal = data.data.suggestions[0];
        assert(meal.name, 'Meal missing name');
        assert(typeof meal.calories === 'number', 'Calories should be a number');
        assert(typeof meal.protein_g === 'number', 'Protein should be a number');
        assert(typeof meal.carbs_g === 'number', 'Carbs should be a number');
        assert(typeof meal.fats_g === 'number', 'Fats should be a number');
        assert(meal.reasoning, 'Meal missing reasoning');
    });

    await test('Handles different goals (fatloss)', async () => {
        const { status, data } = await fetchJSON(`${BASE}/api/food/search`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ query: 'pizza', goal: 'fatloss' })
        });
        assert(status === 200, `Expected 200, got ${status}`);
        assert(data.data.suggestions.length > 0, 'Should return suggestions');
    });

    // ── Endpoint: /api/food/meal-plan ────────────────
    console.log('\n📡 POST /api/food/meal-plan\n');

    await test('Generates a full-day meal plan', async () => {
        const { status, data } = await fetchJSON(`${BASE}/api/food/meal-plan`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ goal: 'balanced', calories: 2000 })
        });
        assert(status === 200, `Expected 200, got ${status}`);
        assert(data.success === true, 'Expected success=true');
        assert(data.data.meals, 'Missing meals array');
        assert(data.data.meals.length >= 3, `Expected at least 3 meals, got ${data.data.meals.length}`);

        const meal = data.data.meals[0];
        assert(meal.time, 'Meal missing time');
        assert(meal.label, 'Meal missing label');
        assert(meal.name, 'Meal missing name');
        assert(typeof meal.calories === 'number', 'Calories should be a number');
    });

    // ── Endpoint: /api/food/shopping-list ────────────
    console.log('\n📡 POST /api/food/shopping-list\n');

    await test('Returns 400 with empty history', async () => {
        const { status, data } = await fetchJSON(`${BASE}/api/food/shopping-list`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ history: [] })
        });
        assert(status === 400, `Expected 400, got ${status}`);
    });

    await test('Generates a shopping list from meal history', async () => {
        const { status, data } = await fetchJSON(`${BASE}/api/food/shopping-list`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                history: [
                    { name: 'Grilled Chicken Salad' },
                    { name: 'Greek Yogurt with Berries' },
                    { name: 'Salmon with Brown Rice' }
                ]
            })
        });
        assert(status === 200, `Expected 200, got ${status}`);
        assert(data.success === true, 'Expected success=true');
        assert(data.data.list, 'Missing list text');
        assert(data.data.list.length > 50, 'Shopping list seems too short');
    });

    // ── Static Files ────────────────────────────────
    console.log('\n📡 Static File Serving\n');

    await test('Serves index.html at root', async () => {
        const res = await fetch(`${BASE}/`);
        assert(res.status === 200, `Expected 200, got ${res.status}`);
        const text = await res.text();
        assert(text.includes('NutriSync'), 'HTML should contain NutriSync');
    });

    await test('Serves styles.css', async () => {
        const res = await fetch(`${BASE}/styles.css`);
        assert(res.status === 200, `Expected 200, got ${res.status}`);
    });

    await test('Serves app.js', async () => {
        const res = await fetch(`${BASE}/app.js`);
        assert(res.status === 200, `Expected 200, got ${res.status}`);
    });

    // ── Summary ─────────────────────────────────────
    console.log('\n' + '━'.repeat(45));
    console.log(`\n🏁 Results: ${passed} passed, ${failed} failed, ${passed + failed} total\n`);

    if (failed > 0) {
        process.exit(1);
    }
})();
