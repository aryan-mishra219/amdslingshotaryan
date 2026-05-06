"""
ai_engine.py — NutriSync Gemini AI Engine (Google Services Integration)

This module demonstrates NutriSync's integration with Google Gemini API
for advanced nutritional analysis. It provides a standalone CLI tool
and importable functions for the backend pipeline.

Google Services Used:
    - Google Gemini 2.0 Flash (Generative AI)
    - google-generativeai SDK

Environment:
    GOOGLE_API_KEY: Your Gemini API key from https://aistudio.google.com/

Usage:
    python ai_engine.py --query "grilled chicken salad" --goal muscle
"""

import os
import json
import argparse
import sys

try:
    import google.generativeai as genai
except ImportError:
    print("❌ Install the SDK: pip install google-generativeai")
    sys.exit(1)


# ─── Configuration ───────────────────────────────────────────────────────────

GEMINI_MODEL = "gemini-2.0-flash"

GOAL_PROFILES = {
    "muscle": {
        "label": "Muscle Gain",
        "macro_split": "40% protein, 35% carbs, 25% fats",
        "focus": "high-protein, calorie-dense"
    },
    "fatloss": {
        "label": "Fat Loss",
        "macro_split": "40% protein, 25% carbs, 35% fats",
        "focus": "high-volume, low-calorie, low-carb"
    },
    "balanced": {
        "label": "Balanced Maintenance",
        "macro_split": "30% protein, 40% carbs, 30% fats",
        "focus": "well-rounded, nutrient-dense"
    }
}

RESPONSE_SCHEMA = {
    "suggestions": [
        {
            "name": "string",
            "calories": "number",
            "protein_g": "number",
            "carbs_g": "number",
            "fats_g": "number",
            "reasoning": "string"
        }
    ]
}


# ─── Core AI Functions ───────────────────────────────────────────────────────

def initialize_gemini(api_key: str = None) -> genai.GenerativeModel:
    """
    Initialize the Google Gemini generative model.
    
    Args:
        api_key: Gemini API key. Falls back to GOOGLE_API_KEY env var.
        
    Returns:
        Configured GenerativeModel instance.
        
    Raises:
        ValueError: If no API key is provided.
    """
    key = api_key or os.environ.get("GOOGLE_API_KEY")
    if not key:
        raise ValueError(
            "GOOGLE_API_KEY is required. "
            "Set it as an environment variable or pass it directly."
        )
    genai.configure(api_key=key)
    return genai.GenerativeModel(GEMINI_MODEL)


def analyze_meal(
    model: genai.GenerativeModel,
    query: str,
    goal: str = "balanced"
) -> dict:
    """
    Analyze a meal and suggest healthier alternatives using Gemini AI.
    
    Args:
        model: Initialized Gemini GenerativeModel.
        query: Description of the meal (e.g., "chicken pasta").
        goal:  One of 'muscle', 'fatloss', 'balanced'.
        
    Returns:
        dict with 'suggestions' array containing meal alternatives.
        
    Raises:
        ValueError: If goal is not recognized.
        RuntimeError: If AI returns unparseable output.
    """
    if goal not in GOAL_PROFILES:
        raise ValueError(f"Invalid goal '{goal}'. Choose: {list(GOAL_PROFILES.keys())}")

    profile = GOAL_PROFILES[goal]
    
    prompt = f"""You are an expert sports nutritionist for the NutriSync app.
A user ate: "{query}".
Their goal is {profile['label']} ({profile['macro_split']}).
Suggest 3 {profile['focus']} alternatives.

Return ONLY a valid JSON object with this structure:
{json.dumps(RESPONSE_SCHEMA, indent=2)}
"""

    response = model.generate_content(prompt)
    text = response.text

    # Extract JSON from response
    start = text.find('{')
    end = text.rfind('}')
    if start == -1 or end == -1:
        raise RuntimeError("Gemini returned an unparseable response.")

    return json.loads(text[start:end + 1])


def generate_meal_plan(
    model: genai.GenerativeModel,
    goal: str = "balanced",
    calories: int = 2000
) -> dict:
    """
    Generate a complete daily meal plan with Gemini AI.
    
    Args:
        model:    Initialized Gemini GenerativeModel.
        goal:     One of 'muscle', 'fatloss', 'balanced'.
        calories: Target daily calorie intake.
        
    Returns:
        dict with 'meals' array containing 5 structured meals.
    """
    profile = GOAL_PROFILES.get(goal, GOAL_PROFILES["balanced"])

    prompt = f"""You are an expert sports nutritionist. Create a complete one-day
meal plan targeting {calories} total calories with {profile['macro_split']}.
Include exactly 5 meals: Breakfast, Morning Snack, Lunch, Afternoon Snack, Dinner.

Return ONLY valid JSON:
{{
  "meals": [
    {{
      "time": "8:00 AM",
      "label": "Breakfast",
      "name": "Meal Name",
      "calories": 0,
      "protein_g": 0,
      "carbs_g": 0,
      "fats_g": 0,
      "description": "Brief description."
    }}
  ]
}}
"""

    response = model.generate_content(prompt)
    text = response.text
    start = text.find('{')
    end = text.rfind('}')
    if start == -1 or end == -1:
        raise RuntimeError("Gemini returned an unparseable response.")
    return json.loads(text[start:end + 1])


# ─── CLI Interface ───────────────────────────────────────────────────────────

def main():
    """Command-line interface for NutriSync AI Engine."""
    parser = argparse.ArgumentParser(
        description="NutriSync AI Engine — Powered by Google Gemini"
    )
    parser.add_argument(
        "--query", "-q",
        type=str,
        help="Food description to analyze (e.g., 'chicken pasta')"
    )
    parser.add_argument(
        "--goal", "-g",
        type=str,
        choices=["muscle", "fatloss", "balanced"],
        default="balanced",
        help="Fitness goal (default: balanced)"
    )
    parser.add_argument(
        "--plan",
        action="store_true",
        help="Generate a full-day meal plan instead of analyzing a meal"
    )
    parser.add_argument(
        "--calories", "-c",
        type=int,
        default=2000,
        help="Target calories for meal plan (default: 2000)"
    )

    args = parser.parse_args()

    if not args.query and not args.plan:
        parser.print_help()
        print("\n❌ Provide --query or --plan flag.")
        sys.exit(1)

    try:
        model = initialize_gemini()

        if args.plan:
            print(f"\n🧠 Generating {args.goal} meal plan ({args.calories} kcal)...\n")
            result = generate_meal_plan(model, args.goal, args.calories)
            for meal in result.get("meals", []):
                print(f"  🕐 {meal['time']} — {meal['label']}")
                print(f"     {meal['name']} ({meal['calories']} kcal)")
                print(f"     P:{meal['protein_g']}g  C:{meal['carbs_g']}g  F:{meal['fats_g']}g")
                print(f"     {meal.get('description', '')}\n")
        else:
            print(f"\n🔍 Analyzing '{args.query}' for {args.goal} goal...\n")
            result = analyze_meal(model, args.query, args.goal)
            for s in result.get("suggestions", []):
                print(f"  ✅ {s['name']}")
                print(f"     {s['calories']} kcal | P:{s['protein_g']}g C:{s['carbs_g']}g F:{s['fats_g']}g")
                print(f"     💡 {s['reasoning']}\n")

        print("✅ Complete! Powered by Google Gemini AI.\n")

    except ValueError as e:
        print(f"❌ Configuration Error: {e}")
        sys.exit(1)
    except Exception as e:
        print(f"❌ AI Error: {e}")
        sys.exit(1)


if __name__ == "__main__":
    main()
