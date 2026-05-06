/**
 * @fileoverview NutriSync AI Food Router
 * @description Handles all AI-powered endpoints using Groq (Llama 3.3 70B)
 *              for meal analysis, planning, and shopping list generation.
 *              Includes input validation, caching, and structured JSON responses.
 * @version 2.0.0
 */

'use strict';

const express = require('express');
const { body, validationResult } = require('express-validator');
const DOMPurify = require('isomorphic-dompurify');
const NodeCache = require('node-cache');
const Groq = require('groq-sdk');

const router = express.Router();

// ─── Cache Layer (TTL: 10 minutes) ──────────────────────────────────────────
const cache = new NodeCache({ stdTTL: 600, checkperiod: 120 });

// ─── AI Client Initialization ───────────────────────────────────────────────
const GROQ_API_KEY = process.env.GROQ_API_KEY;

if (!GROQ_API_KEY || GROQ_API_KEY.startsWith('YOUR_')) {
    console.error('❌ FATAL: GROQ_API_KEY is missing or invalid in .env');
} else {
    console.log(`🤖 Groq AI initialized (key: ${GROQ_API_KEY.substring(0, 8)}...)`);
}

const groq = new Groq({ apiKey: GROQ_API_KEY });

/** @constant {string} TEXT_MODEL  - Primary model for text-only nutrition queries */
const TEXT_MODEL = 'llama-3.3-70b-versatile';

/** @constant {string} VISION_MODEL - Vision model for meal image analysis */
const VISION_MODEL = 'llama-3.2-11b-vision-preview';

// ─── Goal Prompt Map ────────────────────────────────────────────────────────
const GOAL_PROMPTS = {
    muscle: 'Their goal is Muscle Gain. Suggest 3 high-protein, calorie-dense alternatives.',
    fatloss: 'Their goal is Fat Loss. Suggest 3 high-volume, low-calorie, low-carb alternatives.',
    balanced: 'Their goal is Balanced Maintenance. Suggest 3 well-rounded, healthy alternatives.'
};

const GOAL_MACROS = {
    muscle: 'high protein for muscle gain (40% protein, 35% carbs, 25% fats)',
    fatloss: 'high protein, low carb for fat loss (40% protein, 25% carbs, 35% fats)',
    balanced: 'balanced macros for maintenance (30% protein, 40% carbs, 30% fats)'
};

// ─── Utility: Extract JSON from AI Response ─────────────────────────────────
/**
 * Extracts and parses JSON from a raw AI text response.
 * @param {string} text - Raw AI output
 * @returns {Object} Parsed JSON
 * @throws {Error} If no valid JSON is found
 */
const extractJSON = (text) => {
    const start = text.indexOf('{');
    const end = text.lastIndexOf('}');
    if (start === -1 || end === -1) {
        throw new Error('AI returned an invalid response format.');
    }
    return JSON.parse(text.substring(start, end + 1));
};

// ─── Core AI Function ───────────────────────────────────────────────────────
/**
 * Sends a nutrition query to Groq AI and returns structured meal data.
 * Supports both text-only and multimodal (image) requests.
 * 
 * @param {string} query      - User's food description
 * @param {string} goal       - One of: 'muscle', 'fatloss', 'balanced'
 * @param {string|null} image - Base64-encoded image data (optional)
 * @returns {Promise<Object>} Structured nutrition data
 */
const fetchAIData = async (query, goal, image) => {
    const goalPrompt = GOAL_PROMPTS[goal] || GOAL_PROMPTS.balanced;

    let prompt = 'You are an expert sports nutritionist for the NutriSync app. ';
    prompt += image
        ? 'I have uploaded an image of a meal. Identify the food in the image. '
        : `A user ate: "${query}". `;
    prompt += goalPrompt;
    prompt += `
        Return ONLY a valid JSON object (no markdown, no backticks):
        {
          "suggestions": [
            {
              "name": "Meal Name",
              "calories": 0,
              "protein_g": 0,
              "carbs_g": 0,
              "fats_g": 0,
              "reasoning": "Brief reason why this fits their goal."
            }
          ]
        }`;

    const messages = image
        ? [{ role: 'user', content: [
            { type: 'text', text: prompt },
            { type: 'image_url', image_url: { url: `data:image/jpeg;base64,${image}` } }
          ]}]
        : [{ role: 'user', content: prompt }];

    const completion = await groq.chat.completions.create({
        messages,
        model: image ? VISION_MODEL : TEXT_MODEL,
        temperature: 0.7,
        max_tokens: 1024,
        ...(image ? {} : { response_format: { type: 'json_object' } })
    });

    return extractJSON(completion.choices[0]?.message?.content || '');
};


// ═══════════════════════════════════════════════════════════════════════════
// ROUTE: POST /api/food/search
// Analyzes a meal (text or image) and returns AI-powered alternatives.
// ═══════════════════════════════════════════════════════════════════════════
router.post('/search',
    body('goal').optional().isIn(['muscle', 'fatloss', 'balanced']),
    async (req, res) => {
        try {
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                return res.status(400).json({ success: false, errors: errors.array() });
            }

            const rawQuery = req.body.query || '';
            const sanitizedQuery = DOMPurify.sanitize(rawQuery).toLowerCase().trim();
            const goal = req.body.goal || 'balanced';
            const base64Image = req.body.image;

            if (!sanitizedQuery && !base64Image) {
                return res.status(400).json({
                    success: false,
                    error: 'Must provide a text query or an image.'
                });
            }

            // Check cache (text queries only)
            const cacheKey = `search_${goal}_${sanitizedQuery}`;
            if (!base64Image) {
                const cached = cache.get(cacheKey);
                if (cached) {
                    return res.status(200).json({ success: true, cached: true, data: cached });
                }
            }

            const data = await fetchAIData(sanitizedQuery, goal, base64Image);

            if (!base64Image) cache.set(cacheKey, data);
            return res.status(200).json({ success: true, data });
        } catch (error) {
            console.error('[AI Search Error]:', error.message);
            return res.status(500).json({
                success: false,
                error: 'AI Service failed. ' + error.message
            });
        }
    }
);


// ═══════════════════════════════════════════════════════════════════════════
// ROUTE: POST /api/food/meal-plan
// Generates a full structured daily meal plan with macros.
// ═══════════════════════════════════════════════════════════════════════════
router.post('/meal-plan',
    body('goal').optional().isIn(['muscle', 'fatloss', 'balanced']),
    body('calories').optional().isInt({ min: 1200, max: 5000 }),
    async (req, res) => {
        try {
            const goal = req.body.goal || 'balanced';
            const calories = parseInt(req.body.calories, 10) || 2000;
            const macroProfile = GOAL_MACROS[goal] || GOAL_MACROS.balanced;

            const prompt = `
                You are an expert sports nutritionist. Create a complete one-day meal plan
                targeting ${calories} total calories with ${macroProfile}.
                Include exactly 5 meals: Breakfast, Morning Snack, Lunch, Afternoon Snack, Dinner.
                Return ONLY valid JSON (no markdown, no backticks):
                {
                  "meals": [
                    {
                      "time": "8:00 AM",
                      "label": "Breakfast",
                      "name": "Meal Name",
                      "calories": 0,
                      "protein_g": 0,
                      "carbs_g": 0,
                      "fats_g": 0,
                      "description": "Brief 1-line description."
                    }
                  ]
                }`;

            const completion = await groq.chat.completions.create({
                messages: [{ role: 'user', content: prompt }],
                model: TEXT_MODEL,
                temperature: 0.7,
                max_tokens: 1024,
                response_format: { type: 'json_object' }
            });

            const data = extractJSON(completion.choices[0]?.message?.content || '');
            return res.status(200).json({ success: true, data });
        } catch (error) {
            console.error('[Meal Plan Error]:', error.message);
            return res.status(500).json({
                success: false,
                error: 'Failed to generate meal plan.'
            });
        }
    }
);


// ═══════════════════════════════════════════════════════════════════════════
// ROUTE: POST /api/food/shopping-list
// Generates a grocery list from logged meal history.
// ═══════════════════════════════════════════════════════════════════════════
router.post('/shopping-list', async (req, res) => {
    try {
        const history = req.body.history;

        if (!Array.isArray(history) || history.length === 0) {
            return res.status(400).json({
                success: false,
                error: 'Meal history is required (non-empty array).'
            });
        }

        const mealNames = history.map(h => DOMPurify.sanitize(h.name || '')).join(', ');

        const prompt = `
            You are an expert nutritionist assistant. A user plans to eat:
            ${mealNames}.
            Generate a concise, organized grocery shopping list.
            Group items by category (Produce, Meat, Dairy, Pantry).
            Format as a clean list. No introductory text.`;

        const completion = await groq.chat.completions.create({
            messages: [{ role: 'user', content: prompt }],
            model: TEXT_MODEL,
            temperature: 0.5,
            max_tokens: 1024
        });

        const list = completion.choices[0]?.message?.content || 'No list generated.';
        return res.status(200).json({ success: true, data: { list } });
    } catch (error) {
        console.error('[Shopping List Error]:', error.message);
        return res.status(500).json({
            success: false,
            error: 'Failed to generate shopping list.'
        });
    }
});

module.exports = router;
