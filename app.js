/**
 * app.js — NutriSync SPA Controller + Firebase Cloud
 */

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.11.0/firebase-app.js";
import { getAuth, signInWithPopup, GoogleAuthProvider, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.11.0/firebase-auth.js";
import { getFirestore, collection, addDoc, getDocs, query, orderBy, serverTimestamp, limit } from "https://www.gstatic.com/firebasejs/10.11.0/firebase-firestore.js";

// ============================================================
// 🔴 USER: PASTE YOUR FIREBASE CONFIG HERE
// ============================================================
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyBgdlTlrdLkLzd9Ka4AuyEMfJIQN8cAMtU",
  authDomain: "venueiq-4908e.firebaseapp.com",
  projectId: "venueiq-4908e",
  storageBucket: "venueiq-4908e.firebasestorage.app",
  messagingSenderId: "803969370859",
  appId: "1:803969370859:web:769d3754188aa97f8cccae",
  measurementId: "G-0HE6170Y87"
};

// Initialize Firebase ONLY if config is changed from defaults
let app, auth, db;
let isFirebaseReady = firebaseConfig.apiKey !== "YOUR_API_KEY_HERE";

if (isFirebaseReady) {
    app = initializeApp(firebaseConfig);
    auth = getAuth(app);
    db = getFirestore(app);
} else {
    console.warn("⚠️ Firebase is not configured yet. The app is in offline preview mode.");
}

let currentUser = null;

document.addEventListener('DOMContentLoaded', () => {

    // ============================================================
    // DOM REFERENCES
    // ============================================================
    const views = document.querySelectorAll('.view');
    const navItems = document.querySelectorAll('.nav-item');
    const bottomNav = document.querySelector('.bottom-nav');

    const loginBtn = document.getElementById('login-btn');
    const viewLogin = document.getElementById('view-login');
    const viewDashboard = document.getElementById('view-dashboard');

    const mealForm = document.getElementById('meal-form');
    const mealInput = document.getElementById('meal-input');
    const goalSelect = document.getElementById('goal-select');
    const imageInput = document.getElementById('meal-image');
    const dropZone = document.getElementById('drop-zone');
    const imagePreview = document.getElementById('image-preview');
    const voiceBtn = document.getElementById('voice-btn');
    const submitBtn = document.getElementById('submit-btn');

    const formError = document.getElementById('form-error');
    const resultsContainer = document.getElementById('results-container');
    const loadingIndicator = document.getElementById('loading-indicator');
    const resultsTagline = document.getElementById('results-tagline');

    const resetBtn = document.getElementById('reset-btn');
    const mealHistoryList = document.getElementById('meal-history-list');

    const generateListBtn = document.getElementById('generate-list-btn');
    const shoppingListOutput = document.getElementById('shopping-list-output');

    // Dashboard rings
    const ringProtein = document.getElementById('ring-protein');
    const ringCarbs = document.getElementById('ring-carbs');
    const ringFats = document.getElementById('ring-fats');
    const dashProtein = document.getElementById('dash-protein');
    const dashCarbs = document.getElementById('dash-carbs');
    const dashFats = document.getElementById('dash-fats');
    const dashCalories = document.getElementById('dash-calories');

    // NutriScore gauge
    const gaugeFill = document.getElementById('gauge-fill');
    const gaugeGrade = document.getElementById('gauge-grade');
    const gaugeDesc = document.getElementById('gauge-desc');

    // Meal Planner
    const generatePlanBtn = document.getElementById('generate-plan-btn');
    const planOutput = document.getElementById('plan-output');
    const plannerGoal = document.getElementById('planner-goal');
    const plannerCalories = document.getElementById('planner-calories');

    let base64Image = null;
    let isGuestMode = false;
    const guestBtn = document.getElementById('guest-btn');
    const HISTORY_KEY = 'nutrisync_guest_history';

    /**
     * Activates the main app UI (hides login, shows dashboard + nav).
     */
    const enterApp = () => {
        viewLogin.classList.remove('active');
        viewDashboard.classList.add('active');
        document.querySelector('.nav-item[data-view="view-dashboard"]').classList.add('active');
        bottomNav.style.display = 'flex';
        refreshDashboard();
    };

    // ============================================================
    // FIREBASE AUTHENTICATION + GUEST MODE
    // ============================================================
    bottomNav.style.display = 'none'; // Hide nav until logged in

    if (isFirebaseReady) {
        onAuthStateChanged(auth, (user) => {
            if (user && !isGuestMode) {
                currentUser = user;
                resetBtn.textContent = 'Sign Out';
                enterApp();
            } else if (!isGuestMode) {
                currentUser = null;
                viewLogin.classList.add('active');
                views.forEach(v => { if(v.id !== 'view-login') v.classList.remove('active') });
                bottomNav.style.display = 'none';
            }
        });

        loginBtn.addEventListener('click', async () => {
            const provider = new GoogleAuthProvider();
            try {
                loginBtn.innerHTML = '<span class="spinner"></span> Signing in...';
                await signInWithPopup(auth, provider);
            } catch (error) {
                console.error('Login error:', error);
                loginBtn.innerHTML = 'Sign in with Google';
                if (error.code !== 'auth/popup-closed-by-user') {
                    alert('Login failed: ' + error.message);
                }
            }
        });

        resetBtn.addEventListener('click', () => {
            if (isGuestMode) {
                if (confirm('Clear guest data and go back to login?')) {
                    localStorage.removeItem(HISTORY_KEY);
                    isGuestMode = false;
                    location.reload();
                }
            } else {
                if (confirm("Sign out?")) signOut(auth);
            }
        });
    } else {
        loginBtn.addEventListener('click', () => {
            alert("⚠️ Please add your Firebase Config to line 11 in app.js first!");
        });
        resetBtn.addEventListener('click', () => {
            if (confirm('Clear guest data?')) {
                localStorage.removeItem(HISTORY_KEY);
                refreshDashboard();
            }
        });
    }

    // Guest mode — works everywhere, no Firebase needed
    guestBtn.addEventListener('click', () => {
        isGuestMode = true;
        currentUser = null;
        resetBtn.textContent = 'Reset Day';
        enterApp();
    });


    // ============================================================
    // SPA ROUTER
    // ============================================================
    const navigateTo = (viewId) => {
        if (!isGuestMode && !currentUser && isFirebaseReady) return; // Prevent navigation if not logged in
        views.forEach(v => v.classList.remove('active'));
        navItems.forEach(n => n.classList.remove('active'));

        const target = document.getElementById(viewId);
        if (target) target.classList.add('active');

        const activeNav = document.querySelector(`.nav-item[data-view="${viewId}"]`);
        if (activeNav) activeNav.classList.add('active');
    };

    navItems.forEach(item => {
        item.addEventListener('click', () => navigateTo(item.dataset.view));
    });

    // ============================================================
    // DASHBOARD — Cloud Firestore Progress
    // ============================================================
    const GOALS = { protein: 150, carbs: 250, fats: 70 };

    const refreshDashboard = async () => {
        let history = [];

        if (isGuestMode || !isFirebaseReady || !currentUser) {
            // GUEST MODE: use localStorage
            history = JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]');
        } else {
            // FIREBASE MODE: use Firestore
            try {
                const mealsRef = collection(db, "users", currentUser.uid, "meals");
                const q = query(mealsRef, orderBy("timestamp", "desc"), limit(20));
                const snapshot = await getDocs(q);
                snapshot.forEach((doc) => history.push(doc.data()));
            } catch (error) {
                console.error("Error loading from Firestore:", error);
                history = JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]');
            }
        }

        let totalP = 0, totalC = 0, totalF = 0, totalCal = 0;
        history.forEach(m => {
            totalP += (m.protein_g || 0);
            totalC += (m.carbs_g || 0);
            totalF += (m.fats_g || 0);
            totalCal += (m.calories || 0);
        });

        ringProtein.style.setProperty('--progress', Math.min(totalP / GOALS.protein, 1));
        ringCarbs.style.setProperty('--progress', Math.min(totalC / GOALS.carbs, 1));
        ringFats.style.setProperty('--progress', Math.min(totalF / GOALS.fats, 1));

        dashProtein.textContent = totalP;
        dashCarbs.textContent = totalC;
        dashFats.textContent = totalF;
        dashCalories.textContent = totalCal;

        if (history.length === 0) {
            mealHistoryList.innerHTML = '<p class="empty-hint">No meals logged yet. Start tracking!</p>';
        } else {
            const fragment = document.createDocumentFragment();
            history.forEach(m => {
                const div = document.createElement('div');
                div.className = 'history-item';
                div.innerHTML = `
                    <span class="history-item-name">${m.name}</span>
                    <span class="history-item-macros">
                        <span>${m.calories} kcal</span>
                        <span>${m.protein_g}g P</span>
                    </span>
                `;
                fragment.appendChild(div);
            });
            mealHistoryList.innerHTML = '';
            mealHistoryList.appendChild(fragment);
        }

        updateNutriScore(totalP, totalC, totalF, totalCal, GOALS);
    };

    const logMeal = async (meal) => {
        if (!isGuestMode && isFirebaseReady && currentUser) {
            // FIREBASE MODE
            try {
                await addDoc(collection(db, "users", currentUser.uid, "meals"), {
                    name: meal.name,
                    calories: meal.calories,
                    protein_g: meal.protein_g,
                    carbs_g: meal.carbs_g,
                    fats_g: meal.fats_g,
                    timestamp: serverTimestamp()
                });
            } catch (error) {
                console.error("Firestore save failed, using localStorage:", error);
            }
        }

        // Always also save to localStorage as backup
        const local = JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]');
        local.push({ name: meal.name, calories: meal.calories, protein_g: meal.protein_g, carbs_g: meal.carbs_g, fats_g: meal.fats_g });
        localStorage.setItem(HISTORY_KEY, JSON.stringify(local));

        refreshDashboard();

        const dashNav = document.querySelector('[data-view="view-dashboard"]');
        dashNav.style.color = 'var(--secondary)';
        setTimeout(() => { dashNav.style.color = ''; }, 800);
    };

    // ============================================================
    // IMAGE UPLOAD + DRAG & DROP
    // ============================================================
    imageInput.addEventListener('change', handleImageSelect);
    dropZone.addEventListener('dragover', (e) => { e.preventDefault(); dropZone.classList.add('dragover'); });
    dropZone.addEventListener('dragleave', () => { dropZone.classList.remove('dragover'); });
    dropZone.addEventListener('drop', (e) => {
        e.preventDefault();
        dropZone.classList.remove('dragover');
        if (e.dataTransfer.files.length) {
            imageInput.files = e.dataTransfer.files;
            handleImageSelect();
        }
    });

    function handleImageSelect() {
        const file = imageInput.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onloadend = () => {
            base64Image = reader.result.split(',')[1];
            imagePreview.innerHTML = `<img src="${reader.result}" alt="Preview of uploaded meal photo">`;
            imagePreview.classList.remove('hidden');
        };
        reader.readAsDataURL(file);
    }

    // ============================================================
    // VOICE DICTATION (Web Speech API)
    // ============================================================
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SpeechRecognition) {
        const recognition = new SpeechRecognition();
        recognition.continuous = false;
        recognition.interimResults = false;

        voiceBtn.addEventListener('click', () => {
            voiceBtn.classList.add('recording');
            recognition.start();
        });

        recognition.onresult = (e) => {
            mealInput.value = e.results[0][0].transcript;
            voiceBtn.classList.remove('recording');
        };
        recognition.onerror = () => voiceBtn.classList.remove('recording');
        recognition.onend = () => voiceBtn.classList.remove('recording');
    } else {
        voiceBtn.disabled = true;
        voiceBtn.style.opacity = '0.3';
    }

    // ============================================================
    // FORM SUBMISSION — Fetch AI Alternatives
    // ============================================================
    mealForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const query = mealInput.value.trim();
        const goal = goalSelect.value;
        formError.textContent = '';

        if (!query && !base64Image) {
            formError.textContent = 'Please enter a meal or upload a photo.';
            return;
        }

        navigateTo('view-results');
        resultsContainer.innerHTML = '';
        loadingIndicator.classList.remove('hidden');
        resultsTagline.textContent = 'Analyzing your meal with AI...';

        submitBtn.querySelector('.btn-text').classList.add('hidden');
        submitBtn.querySelector('.btn-loader').classList.remove('hidden');
        submitBtn.disabled = true;

        try {
            const response = await fetch('/api/food/search', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ query, goal, image: base64Image })
            });

            if (!response.ok) {
                const errData = await response.json();
                throw new Error(errData.error || 'Server error');
            }

            const result = await response.json();
            const meals = (result.data && result.data.suggestions) ? result.data.suggestions : [];
            renderResults(meals);
        } catch (err) {
            resultsContainer.innerHTML = `<div class="card glass"><p class="error-message">Error: ${err.message}</p></div>`;
        } finally {
            loadingIndicator.classList.add('hidden');
            submitBtn.querySelector('.btn-text').classList.remove('hidden');
            submitBtn.querySelector('.btn-loader').classList.add('hidden');
            submitBtn.disabled = false;
            base64Image = null;
            imagePreview.classList.add('hidden');
            imagePreview.innerHTML = '';
            resultsTagline.textContent = 'AI-curated meals for your goals';
        }
    });

    const renderResults = (meals) => {
        resultsContainer.innerHTML = '';

        if (!meals || meals.length === 0) {
            resultsContainer.innerHTML = '<div class="card glass empty-card"><p class="empty-hint">No alternatives found. Try rephrasing your query.</p></div>';
            return;
        }

        const fragment = document.createDocumentFragment();

        meals.forEach((meal) => {
            const card = document.createElement('article');
            card.className = 'meal-card';

            card.innerHTML = `
                <h3>${meal.name}</h3>
                <div class="meal-stats">
                    <span class="stat-badge">🔥 ${meal.calories} kcal</span>
                    <span class="stat-badge" style="color: var(--protein-color);">🥩 ${meal.protein_g}g Pro</span>
                    <span class="stat-badge" style="color: var(--carbs-color);">🍞 ${meal.carbs_g}g Carb</span>
                    <span class="stat-badge" style="color: var(--fats-color);">🥑 ${meal.fats_g}g Fat</span>
                </div>
                <p>${meal.reasoning}</p>
            `;

            const logBtn = document.createElement('button');
            logBtn.className = 'btn btn-log';
            logBtn.textContent = '✓ Log this Meal';
            logBtn.addEventListener('click', () => {
                logMeal(meal);
                logBtn.textContent = '✓ Saved to Cloud';
                logBtn.disabled = true;
                logBtn.style.opacity = '0.5';
            });
            card.appendChild(logBtn);
            fragment.appendChild(card);
        });

        resultsContainer.appendChild(fragment);
    };

    // ============================================================
    // SHOPPING LIST GENERATOR (Using Cloud Data)
    // ============================================================
    generateListBtn.addEventListener('click', async () => {
        generateListBtn.querySelector('.btn-text').classList.add('hidden');
        generateListBtn.querySelector('.btn-loader').classList.remove('hidden');
        generateListBtn.disabled = true;
        shoppingListOutput.innerHTML = '';

        try {
            let history = [];
            if (!isGuestMode && isFirebaseReady && currentUser) {
                const mealsRef = collection(db, "users", currentUser.uid, "meals");
                const q = query(mealsRef, orderBy("timestamp", "desc"), limit(20));
                const snapshot = await getDocs(q);
                snapshot.forEach(doc => history.push(doc.data()));
            } else {
                history = JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]');
            }

            if (history.length === 0) {
                shoppingListOutput.innerHTML = '<p class="empty-hint">Log some meals first.</p>';
                return;
            }

            const response = await fetch('/api/food/shopping-list', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ history })
            });

            if (!response.ok) throw new Error('Failed to generate list');

            const result = await response.json();
            const listText = result.data.list || 'No list generated.';

            const formatted = listText
                .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
                .replace(/## (.*)/g, '<h3>$1</h3>')
                .replace(/- (.*)/g, '• $1')
                .replace(/\n/g, '<br>');

            shoppingListOutput.innerHTML = formatted;
        } catch (err) {
            shoppingListOutput.innerHTML = `<p class="error-message">Error: ${err.message}</p>`;
        } finally {
            generateListBtn.querySelector('.btn-text').classList.remove('hidden');
            generateListBtn.querySelector('.btn-loader').classList.add('hidden');
            generateListBtn.disabled = false;
        }
    });

    // ============================================================
    // AI MEAL PLANNER
    // ============================================================
    generatePlanBtn.addEventListener('click', async () => {
        const goal = plannerGoal.value;
        const calories = parseInt(plannerCalories.value) || 2000;

        generatePlanBtn.querySelector('.btn-text').classList.add('hidden');
        generatePlanBtn.querySelector('.btn-loader').classList.remove('hidden');
        generatePlanBtn.disabled = true;
        planOutput.innerHTML = '';

        try {
            const response = await fetch('/api/food/meal-plan', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ goal, calories })
            });

            if (!response.ok) throw new Error('Failed to generate plan');

            const result = await response.json();
            const meals = (result.data && result.data.meals) ? result.data.meals : [];

            if (meals.length === 0) {
                planOutput.innerHTML = '<div class="card glass empty-card"><p class="empty-hint">No plan generated. Try again.</p></div>';
                return;
            }

            const timeline = document.createElement('div');
            timeline.className = 'timeline';

            meals.forEach(meal => {
                const item = document.createElement('div');
                item.className = 'timeline-item';
                item.innerHTML = `
                    <div class="timeline-dot"></div>
                    <div class="timeline-card">
                        <div class="timeline-time">${meal.time} — ${meal.label}</div>
                        <h4>${meal.name}</h4>
                        <div class="meal-stats">
                            <span class="stat-badge">🔥 ${meal.calories} kcal</span>
                            <span class="stat-badge" style="color:var(--protein-color);">🥩 ${meal.protein_g}g P</span>
                            <span class="stat-badge" style="color:var(--carbs-color);">🍞 ${meal.carbs_g}g C</span>
                            <span class="stat-badge" style="color:var(--fats-color);">🥑 ${meal.fats_g}g F</span>
                        </div>
                        <p>${meal.description}</p>
                    </div>
                `;
                timeline.appendChild(item);
            });

            planOutput.innerHTML = '';
            planOutput.appendChild(timeline);
        } catch (err) {
            planOutput.innerHTML = `<div class="card glass"><p class="error-message">Error: ${err.message}</p></div>`;
        } finally {
            generatePlanBtn.querySelector('.btn-text').classList.remove('hidden');
            generatePlanBtn.querySelector('.btn-loader').classList.add('hidden');
            generatePlanBtn.disabled = false;
        }
    });

});

// ============================================================
// NUTRISCORE CALCULATOR (standalone function)
// ============================================================
function updateNutriScore(totalP, totalC, totalF, totalCal, goals) {
    const gaugeFill = document.getElementById('gauge-fill');
    const gaugeGrade = document.getElementById('gauge-grade');
    const gaugeDesc = document.getElementById('gauge-desc');
    if (!gaugeFill) return;

    if (totalCal === 0) {
        gaugeFill.style.strokeDashoffset = '251.3';
        gaugeGrade.textContent = '—';
        gaugeDesc.textContent = 'Log meals to see your score';
        return;
    }

    // Score based on how close macros are to goals (max 100)
    const pScore = Math.min(totalP / goals.protein, 1.2);
    const cScore = Math.min(totalC / goals.carbs, 1.2);
    const fScore = Math.min(totalF / goals.fats, 1.2);

    // Penalize going over
    const pPenalty = totalP > goals.protein * 1.3 ? 0.8 : 1;
    const cPenalty = totalC > goals.carbs * 1.3 ? 0.7 : 1;
    const fPenalty = totalF > goals.fats * 1.3 ? 0.7 : 1;

    let score = ((pScore * 40 * pPenalty) + (cScore * 30 * cPenalty) + (fScore * 30 * fPenalty));
    score = Math.min(Math.round(score), 100);

    // Map score to gauge arc (251.3 is full arc length)
    const offset = 251.3 - (251.3 * score / 100);
    gaugeFill.style.strokeDashoffset = offset;

    // Grade
    let grade, desc;
    if (score >= 90) { grade = 'A+'; desc = 'Outstanding balance!'; }
    else if (score >= 75) { grade = 'A'; desc = 'Great macro balance'; }
    else if (score >= 60) { grade = 'B'; desc = 'Good progress, keep going'; }
    else if (score >= 40) { grade = 'C'; desc = 'Room for improvement'; }
    else if (score >= 20) { grade = 'D'; desc = 'Needs more balance'; }
    else { grade = 'F'; desc = 'Log more balanced meals'; }

    gaugeGrade.textContent = grade;
    gaugeDesc.textContent = desc;
}
