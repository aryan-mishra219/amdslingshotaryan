# NutriSync — AI-Powered Smart Nutrition

> **Cloud-native, AI-driven meal tracking platform** built for the AMD Slingshot Hackathon.  
> Analyzes meals, suggests healthier alternatives, generates daily plans, and auto-creates shopping lists.

---

## 🏆 Google Services Used

| Service | Purpose |
|---------|---------|
| **Google Gemini 2.0 Flash** | AI engine for nutrition analysis (`ai_engine.py`) |
| **Firebase Authentication** | Google Sign-In for secure user management |
| **Cloud Firestore** | Real-time cloud database for meal persistence |
| **Google Cloud Run** | Containerized production deployment |
| **Google Analytics** | User engagement tracking (`gtag.js`) |
| **Google Fonts** | Inter typeface for premium typography |

## ⚡ Features

- **AI Meal Analysis** — Describe or photograph food, get macro-optimized alternatives
- **AI Meal Planner** — Generate a full structured 5-meal daily plan
- **Voice-to-Log** — Hands-free meal logging via Web Speech API
- **NutriScore Gauge** — Animated SVG gauge rating daily nutrition (A+ to F)
- **Smart Shopping List** — Auto-generated grocery list from meal history
- **Goal Modes** — Muscle Gain, Fat Loss, and Balanced Maintenance
- **Guest Mode** — Full functionality without login for instant demos

## 🛠 Tech Stack

| Layer | Technology |
|-------|-----------|
| **Backend** | Node.js, Express.js |
| **AI (Primary)** | Groq SDK (Llama 3.3 70B Versatile) |
| **AI (Google)** | Google Gemini 2.0 Flash (`ai_engine.py`) |
| **Database** | Firebase Cloud Firestore |
| **Auth** | Firebase Authentication (Google OAuth) |
| **Frontend** | Vanilla JS (ES Modules), CSS3 |
| **Deployment** | Docker → Google Cloud Run |
| **Security** | Helmet, CORS, express-rate-limit, express-validator, DOMPurify |

## 🚀 Quick Start

```bash
# 1. Install dependencies
npm install

# 2. Configure environment
cp .env.example .env
# Add your GROQ_API_KEY to .env

# 3. Run the server
node server.js

# 4. Run tests
node test_suite.js
```

## 🔑 Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `GROQ_API_KEY` | ✅ | API key from [console.groq.com/keys](https://console.groq.com/keys) |
| `GOOGLE_API_KEY` | Optional | Gemini API key for `ai_engine.py` |
| `PORT` | Optional | Server port (default: 3000) |

## 🧪 Testing

```bash
# Start server first
node server.js

# Run full test suite (15 tests)
node test_suite.js
```

Tests cover:
- Health check endpoint
- Input validation (empty queries, invalid goals)
- AI response structure validation
- Cache behavior verification
- Shopping list generation
- Static file serving
- Security header verification (Helmet)

## 📁 Project Structure

```
nutrisync/
├── server.js          # Express server with security middleware
├── routes/food.js     # AI-powered API endpoints (Groq)
├── ai_engine.py       # Google Gemini AI engine (Python)
├── index.html         # WCAG 2.1 AA accessible SPA
├── styles.css         # Premium dark-mode glassmorphism UI
├── app.js             # Frontend SPA controller + Firebase
├── test_suite.js      # API test suite (15 tests)
├── Dockerfile         # Cloud Run container config
├── .env               # Environment variables (gitignored)
└── README.md          # This file
```

## ♿ Accessibility (WCAG 2.1 AA)

- Skip navigation link
- ARIA labels on all interactive elements
- `role="meter"` on progress rings
- `aria-live="polite"` on dynamic content regions
- High-contrast color palette (4.5:1+ ratio)
- Keyboard-navigable interface
- Semantic HTML5 structure

## 🔒 Security

- **Helmet.js** — HTTP security headers
- **CORS** — Origin-restricted in production
- **Rate Limiting** — 100 req/15min per IP
- **Input Sanitization** — DOMPurify + express-validator
- **No secrets in code** — All keys via environment variables

## 📊 Efficiency Optimizations

- **Response Caching** — NodeCache with 10-min TTL
- **Static Asset Caching** — 1-hour max-age with ETags
- **GPU-accelerated animations** — `transform`/`opacity` only
- **Lazy Firebase init** — Only loads when config is valid
- **Lightweight Docker image** — `node:20-slim` base

---

**Built with ❤️ for the AMD Slingshot Hackathon**
