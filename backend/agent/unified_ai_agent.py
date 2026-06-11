from typing import Dict, Any
import os, json
import vertexai
from vertexai.generative_models import GenerativeModel
from dotenv import load_dotenv

from backend.db.recipe_cache_repository import (
    get_cached_recipe,
    save_recipe_cache
)

load_dotenv()

PROJECT_ID = os.getenv("GOOGLE_PROJECT_ID")
MODEL_NAME = os.getenv("GEMINI_MODEL_NAME", "gemini-1.5-flash")

# =====================================================
# CACHE KEY BUILDER
# dietary is included so "Pasta|Vegan" and
# "Pasta|Vegetarian" are cached separately
# =====================================================

def _cache_key(meal: str, dietary: str) -> str:
    return f"{meal.strip().lower()}|{dietary.strip().lower()}"


# =====================================================
# PROMPT BUILDER
# Only used when cache misses — saves API cost
# =====================================================

def _build_prompt(weekly_meals: dict, dietary: str, manual_items: list) -> str:
    return f"""
You are a world-class grocery planning AI.

You MUST return ONLY valid JSON.

TASK:
Generate:
1. shopping list
2. nutrition analysis
3. smart substitutions

INPUT:
Weekly meals: {weekly_meals}
Manual items: {manual_items}
Dietary rule: {dietary}

OUTPUT FORMAT (STRICT JSON ONLY):

{{
  "shopping_list": ["item1", "item2", "item3"],

  "nutrition_report": {{
    "calories": <estimated total daily calories as integer e.g. 1850>,
    "protein_g": <estimated total protein in grams as integer e.g. 72>,
    "carbs_g": <estimated total carbs in grams as integer e.g. 210>,
    "fat_g": <estimated total fat in grams as integer e.g. 58>,
    "fiber_g": <estimated total fiber in grams as integer e.g. 28>,
    "protein_score": <score 0-10 integer>,
    "vegetable_score": <score 0-10 integer>,
    "carb_score": <score 0-10 integer>,
    "fat_score": <score 0-10 integer>,
    "health_rating": "<e.g. Good, Excellent, Fair>",
    "summary": "<2-3 sentence health summary>",
    "strengths": ["<strength1>", "<strength2>"],
    "weaknesses": ["<weakness1>"],
    "recommendations": ["<recommendation1>", "<recommendation2>"]
  }},

IMPORTANT: calories, protein_g, carbs_g, fat_g, fiber_g MUST be estimated numeric values based on the meals — never use 0.

  "substitutions": {{
    "item1": ["alt1", "alt2"],
    "item2": ["alt1", "alt2"]
  }}
}}

RULES:
- Follow the dietary rule strictly
- No markdown
- No explanation
- Valid JSON ONLY
"""


# =====================================================
# SAFE RESPONSE FORMATTER
# =====================================================

def _format_response(parsed: dict, source: str = "gemini") -> Dict[str, Any]:
    nr = parsed.get("nutrition_report", {})

    # If already nested (from cache), use as-is — don't re-wrap
    if "nutrition_scores" in nr:
        nutrition_report = nr
    else:
        # Flat Gemini response — reshape into nested structure
        nutrition_report = {
            "nutrition_scores": {
                "calories":        nr.get("calories",        0),
                "protein_g":       nr.get("protein_g",       0),
                "carbs_g":         nr.get("carbs_g",         0),
                "fat_g":           nr.get("fat_g",           0),
                "fiber_g":         nr.get("fiber_g",         0),
                "protein_score":   nr.get("protein_score",   0),
                "vegetable_score": nr.get("vegetable_score", 0),
                "carb_score":      nr.get("carb_score",      0),
                "fat_score":       nr.get("fat_score",       0),
                "health_rating":   nr.get("health_rating",   "auto"),
            },
            "ai_feedback": {
                "summary":         nr.get("summary",         ""),
                "strengths":       nr.get("strengths",       []),
                "weaknesses":      nr.get("weaknesses",      []),
                "recommendations": nr.get("recommendations", []),
            }
        }

    return {
        "shopping_list":  parsed.get("shopping_list", []),
        "nutrition_report": nutrition_report,
        "substitutions":  parsed.get("substitutions", {}),
        "_source":        source
    }


# =====================================================
# MAIN ENTRY POINT
# Decision tree:
#   1. Single meal? → check recipe_cache first
#   2. Cache hit   → return instantly, no AI call
#   3. Cache miss  → call Vertex AI Gemini
#   4. Save result → cache for next time
#   5. Gemini fail → deterministic fallback
# =====================================================

def run_unified_ai(
    weekly_meals: dict,
    manual_items: list = None,
    dietary: str = "Vegetarian only",
    force_refresh: bool = False
) -> Dict[str, Any]:

    # Cache check — skip entirely if regenerating
    cached_ingredients = None
    if not force_refresh and len(weekly_meals) == 1:
        meal = list(weekly_meals.values())[0]
        key = _cache_key(meal, dietary)
        cached = get_cached_recipe(key)
        if cached:
            ingredients = cached.get("ingredients") or cached.get("shopping_list", [])
            substitutions = cached.get("substitutions", {})
            nutrition = cached.get("nutrition_report", {})
            # Only return early if we have ALL fields — otherwise fall through to Gemini
            if ingredients and substitutions and nutrition:
                print(f"[unified_ai] Full cache hit for: '{key}' — no Gemini call needed")
                normalized = {
                    "shopping_list": ingredients,
                    "substitutions": substitutions,
                    "nutrition_report": nutrition,
                }
                return _format_response(normalized, source="cache")
            else:
                print(f"[unified_ai] Partial cache hit for: '{key}' — calling Gemini to fill missing fields")
                cached_ingredients = ingredients  # reuse ingredients, get rest from Gemini

    manual_items = manual_items or []

    vertexai.init(project=PROJECT_ID, location="us-central1")
    model = GenerativeModel(MODEL_NAME)

    # GEMINI CALL — always call for fresh nutrition + substitutions
    # If we have cached ingredients, pass them in the prompt so Gemini
    # generates matching substitutions without regenerating the list
    prompt = _build_prompt(
        weekly_meals,
        dietary,
        manual_items if not cached_ingredients else cached_ingredients
    )

    try:
        response = model.generate_content(prompt)
        text = response.text.strip()

        if "```" in text:
            text = text.split("```")[1]
            if text.lower().startswith("json"):
                text = text[4:]
            text = text.strip()

        parsed = json.loads(text)

        # If we had cached ingredients, use them — only take substitutions + nutrition from Gemini
        if cached_ingredients:
            parsed["shopping_list"] = cached_ingredients
            print(f"[unified_ai] Using cached ingredients ({len(cached_ingredients)} items) with fresh substitutions")

        result = _format_response(parsed, source="cache+gemini" if cached_ingredients else "gemini")

        shopping_list = result["shopping_list"]
        if shopping_list and weekly_meals:
            for meal in weekly_meals.values():
                key = _cache_key(meal, dietary)
                save_recipe_cache(
                    meal=key,
                    ingredients=shopping_list,
                    source="gemini",
                    nutrition=result["nutrition_report"],
                    substitutions=result.get("substitutions", {})  # ← save substitutions too
                )
                print(f"[unified_ai] Cached ingredients+substitutions for: '{meal}'")

        return result

    except Exception as e:
        print(f"[unified_ai] Gemini failed: {e}")
        return {
            "shopping_list": manual_items,
            "nutrition_report": {
                "nutrition_scores": {
                    "calories": 0, "protein_g": 0,
                    "carbs_g": 0, "fat_g": 0,
                    "fiber_g": 0, "protein_score": 0,
                    "vegetable_score": 0, "carb_score": 0,
                    "fat_score": 0, "health_rating": "—"
                },
                "ai_feedback": {
                    "summary": "AI unavailable.",
                    "strengths": [], "weaknesses": [],
                    "recommendations": ["Try again in a few minutes"]
                }
            },
            "substitutions": {},
            "_source": "fallback"
            }
