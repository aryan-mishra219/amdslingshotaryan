const dotenv = require('dotenv');
const path = require('path');

// Load environment variables immediately at the very top
dotenv.config({ path: path.join(__dirname, '.env'), override: true });

const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const foodRoutes = require('./routes/food');
const app = express();

/**
 * Apply security and utility middlewares
 */
app.use(helmet({
    contentSecurityPolicy: false // Allow inline styles for our premium UI
}));
app.use(cors());
app.use(express.json({ limit: '10mb' })); // Allow large base64 image uploads

/**
 * Serve static frontend files from the current directory
 */
app.use(express.static(path.join(__dirname, './')));

/**
 * Rate Limiting to prevent abuse
 */
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // Limit each IP to 100 requests per windowMs
    message: 'Too many requests from this IP, please try again later.',
    standardHeaders: true,
    legacyHeaders: false
});
app.use(limiter);

/**
 * Mount Routes
 */
app.use('/api/food', foodRoutes);

/**
 * Global Error Handler Middleware
 * @param {Error} err - The error object
 * @param {import('express').Request} req - The request object
 * @param {import('express').Response} res - The response object
 * @param {import('express').NextFunction} next - The next middleware function
 */
app.use((err, req, res, next) => {
    console.error(`[Error]: ${err.message}`);
    const status = err.status || 500;
    res.status(status).json({
        success: false,
        error: process.env.NODE_ENV === 'production' ? 'Internal Server Error' : err.message
    });
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
    console.log(`NutriSync server is running on port ${PORT}`);
});
