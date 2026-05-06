const express = require('express');
const { body, validationResult } = require('express-validator');
const DOMPurify = require('isomorphic-dompurify');
const NodeCache = require('node-cache');
const Groq = require('groq-sdk');

const router = express.Router();
const cache = new NodeCache({ stdTTL: 600 });

const apiKey = process.env.GROQ_API_KEY;
if (!apiKey || apiKey.includes('YOUR_GROQ')) {
    console.error('❌ ERROR: No valid GROQ_API_KEY found in .env file!');
} else {
    console.log(`🚀 NutriSync AI (Groq) initialized with key: ${apiKey.substring(0, 8)}...`);
}

const groq = new Groq({ apiKey });

// Models
const TEXT_MODEL = "llama-3.3-70b-versatile";
const VISION_MODEL = "llama-3.2-11b-vision-preview";

/**
 * Calls the Groq AI API.
 * Uses the vision model for image inputs, text model otherwise.
 */
const fetchAIData = async (query, goal, base64Image) => {
    let promptText = `You are an expert sports nutritionist for the NutriSync app. `;
    
    if (base64Image) {
        promptText += `I have uploaded an image of a meal. Identify the food in the image. `;
    } else {
        promptText += `A user ate: "${query}". `;
    }

    // Adjust prompt based on the goal
    if (goal === 'muscle') {
        promptText += `Their goal is Muscle Gain. Suggest 3 high-protein, calorie-dense alternatives. `;
    } else if (goal === 'fatloss') {
        promptText += `Their goal is Fat Loss. Suggest 3 high-volume, low-calorie, low-carb alternatives. `;
    } else {
        promptText += `Their goal is Balanced Maintenance. Suggest 3 well-rounded, healthy alternatives. `;
    }
    
    promptText += `
        Return ONLY a valid JSON object with this exact structure (no markdown, no backticks, no extra text):
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
        }
    `;

    let messages;

    if (base64Image) {
        // Multimodal request with vision model
        messages = [{
            role: "user",
            content: [
                { type: "text", text: promptText },
                { type: "image_url", image_url: { url: `data:image/jpeg;base64,${base64Image}` } }
            ]
        }];
    } else {
        // Text-only request
        messages = [{ role: "user", content: promptText }];
    }

    const completion = await groq.chat.completions.create({
        messages,
        model: base64Image ? VISION_MODEL : TEXT_MODEL,
        temperature: 0.7,
        max_tokens: 1024,
        response_format: base64Image ? undefined : { type: "json_object" }
    });

    const text = completion.choices[0]?.message?.content || '';
    
    // Clean JSON text
    const startIdx = text.indexOf('{');
    const endIdx = text.lastIndexOf('}');
    if (startIdx === -1 || endIdx === -1) {
        throw new Error("Invalid JSON structure returned from AI.");
    }
    const cleanJSON = text.substring(startIdx, endIdx + 1);
    
    return JSON.parse(cleanJSON);
};

router.post(
    '/search',
    async (req, res, next) => {
        try {
            const rawQuery = req.body.query || "";
            const sanitizedQuery = DOMPurify.sanitize(rawQuery).toLowerCase();
            const goal = req.body.goal || "balanced";
            const base64Image = req.body.image;

            if (!sanitizedQuery && !base64Image) {
                return res.status(400).json({ success: false, error: "Must provide a query or an image." });
            }

            const cacheKey = `${goal}_${sanitizedQuery}_${base64Image ? 'img' : 'noimg'}`;
            const cached = cache.get(cacheKey);
            
            if (cached) {
                return res.status(200).json({ success: true, cached: true, data: cached });
            }

            const aiResult = await fetchAIData(sanitizedQuery, goal, base64Image);

            cache.set(cacheKey, aiResult);
            return res.status(200).json({ success: true, data: aiResult });
        } catch (error) {
            console.error('AI Error:', error);
            res.status(500).json({ success: false, error: "AI Service failed. " + error.message });
        }
    }
);

// --- SHOPPING LIST GENERATOR ---
router.post('/shopping-list', async (req, res, next) => {
    try {
        const history = req.body.history;
        if (!history || history.length === 0) {
            return res.status(400).json({ success: false, error: "No history provided." });
        }

        const mealNames = history.map(h => h.name).join(', ');
        
        const prompt = `
            You are an expert nutritionist assistant. A user is planning to eat these meals over the next few days: ${mealNames}.
            Generate a concise, organized grocery shopping list based on these meals.
            Group items by category (e.g., Produce, Meat, Dairy, Pantry).
            Format it nicely as a list. Do not include introductory text.
        `;

        const completion = await groq.chat.completions.create({
            messages: [{ role: "user", content: prompt }],
            model: TEXT_MODEL,
            temperature: 0.5,
            max_tokens: 1024
        });

        const text = completion.choices[0]?.message?.content || 'No list generated.';
        return res.status(200).json({ success: true, data: { list: text } });
    } catch (error) {
        console.error('Shopping List Error:', error);
        res.status(500).json({ success: false, error: "Failed to generate shopping list." });
    }
});

// --- AI MEAL PLANNER ---
router.post('/meal-plan', async (req, res, next) => {
    try {
        const goal = req.body.goal || 'balanced';
        const calories = req.body.calories || 2000;

        let goalText = 'balanced macros for maintenance';
        if (goal === 'muscle') goalText = 'high protein for muscle gain (40% protein, 35% carbs, 25% fats)';
        if (goal === 'fatloss') goalText = 'high protein, low carb for fat loss (40% protein, 25% carbs, 35% fats)';

        const prompt = `
            You are an expert sports nutritionist. Create a complete one-day meal plan
            targeting ${calories} total calories with ${goalText}.

            Include exactly 5 meals: Breakfast, Morning Snack, Lunch, Afternoon Snack, Dinner.

            Return ONLY a valid JSON object (no markdown, no backticks) with this exact structure:
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
                  "description": "Brief 1-line description of the meal and its benefits."
                }
              ]
            }
        `;

        const completion = await groq.chat.completions.create({
            messages: [{ role: "user", content: prompt }],
            model: TEXT_MODEL,
            temperature: 0.7,
            max_tokens: 1024,
            response_format: { type: "json_object" }
        });

        const text = completion.choices[0]?.message?.content || '';

        const startIdx = text.indexOf('{');
        const endIdx = text.lastIndexOf('}');
        if (startIdx === -1 || endIdx === -1) throw new Error("Invalid JSON from AI.");
        const cleanJSON = text.substring(startIdx, endIdx + 1);

        return res.status(200).json({ success: true, data: JSON.parse(cleanJSON) });
    } catch (error) {
        console.error('Meal Plan Error:', error);
        res.status(500).json({ success: false, error: "Failed to generate meal plan." });
    }
});

module.exports = router;
