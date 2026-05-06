/**
 * @fileoverview NutriSync Express Server
 * @description Production-grade Node.js server with enterprise security,
 *              rate limiting, input sanitization, and structured error handling.
 * @version 2.0.0
 * @license MIT
 */

'use strict';

const dotenv = require('dotenv');
const path = require('path');

// Load environment variables BEFORE any module reads them
dotenv.config({ path: path.join(__dirname, '.env'), override: true });

const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const foodRoutes = require('./routes/food');

const app = express();

// ─── Security Middleware ────────────────────────────────────────────────────
app.use(helmet({
    contentSecurityPolicy: false, // Relaxed for Firebase CDN scripts
    crossOriginEmbedderPolicy: false
}));

app.use(cors({
    origin: process.env.NODE_ENV === 'production'
        ? ['https://nutrisync-257323972871.us-central1.run.app']
        : '*',
    methods: ['GET', 'POST'],
    allowedHeaders: ['Content-Type']
}));

// ─── Body Parsing ───────────────────────────────────────────────────────────
app.use(express.json({ limit: '10mb' }));     // Support base64 image uploads
app.use(express.urlencoded({ extended: false }));

// ─── Static Assets ──────────────────────────────────────────────────────────
app.use(express.static(path.join(__dirname, './'), {
    maxAge: '1h',
    etag: true
}));

// ─── Rate Limiting ──────────────────────────────────────────────────────────
const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,  // 15-minute window
    max: 100,                   // 100 requests per window per IP
    standardHeaders: true,
    legacyHeaders: false,
    message: { success: false, error: 'Rate limit exceeded. Please try again later.' }
});
app.use('/api/', apiLimiter);

// ─── API Routes ─────────────────────────────────────────────────────────────
app.use('/api/food', foodRoutes);

// ─── Health Check ───────────────────────────────────────────────────────────
app.get('/api/health', (_req, res) => {
    res.status(200).json({
        status: 'healthy',
        uptime: process.uptime(),
        timestamp: new Date().toISOString()
    });
});

// ─── Global Error Handler ───────────────────────────────────────────────────
app.use((err, _req, res, _next) => {
    console.error(`[Error ${new Date().toISOString()}]: ${err.message}`);
    const status = err.status || 500;
    res.status(status).json({
        success: false,
        error: process.env.NODE_ENV === 'production'
            ? 'Internal Server Error'
            : err.message
    });
});

// ─── Server Bootstrap ───────────────────────────────────────────────────────
const PORT = parseInt(process.env.PORT, 10) || 3000;

app.listen(PORT, () => {
    console.log(`✅ NutriSync server running on port ${PORT}`);
    console.log(`🔒 Security: Helmet, CORS, Rate Limiting active`);
    console.log(`🤖 AI Engine: Groq (Llama 3.3 70B)`);
});
