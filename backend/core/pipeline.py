from typing import Any, Dict

from backend.optimization.budget_optimizer import weekly_budget_planner
from backend.services.store_finder import recommend_best_store
from backend.optimization.route_optimizer import optimize_route
from backend.services.location import get_user_location
from backend.utils.sanitizers import clean_shopping_list, clean_stores
from backend.core.registry import MCP_REGISTRY
from backend.agent.unified_ai_agent import run_unified_ai
from backend.validators.nutrition_validator import validate_nutrition
from backend.db.recipe_cache_repository import (
    get_cached_recipe,
    save_recipe_cache
)


def _apply_substitutions(
    shopping_list: list,
    selected_substitutions: dict
) -> list:
    """
    Replaces original items with user's chosen substitutes.
    e.g. {"parmesan cheese": "nutritional yeast"}
    → "parmesan cheese" in list becomes "nutritional yeast"
    """
    if not selected_substitutions:
        return shopping_list

    return [
        selected_substitutions.get(item, item)
        for item in shopping_list
    ]


def _persist_substitutions_to_cache(
    weekly_meals: dict,
    shopping_list: list,
    selected_substitutions: dict,
    dietary: str
):
    """
    Updates recipe cache with user's substitution preferences.
    Next time the same meal is searched, the personalized
    list (with substitutions applied) is returned instead
    of re-calling Gemini.
    """
    if not selected_substitutions or not weekly_meals:
        return

    # Apply substitutions to get personalized list
    personalized = _apply_substitutions(
        shopping_list,
        selected_substitutions
    )

    # Update cache for each meal in the plan
    for day, meal in weekly_meals.items():
        meal_key  = " ".join(meal.strip().lower().split())  # collapse double spaces
        cache_key = f"{meal_key}|{dietary.lower().strip()}"

        # Get existing cached ingredients
        cached = get_cached_recipe(cache_key)
        existing = cached.get("ingredients", []) if cached else shopping_list  # ← fallback to current list

        # Merge: apply substitutions to cached ingredients
        updated = [
            selected_substitutions.get(item, item)
            for item in existing
        ]

        # Save updated personalized cache — preserve existing nutrition + substitutions
        existing_nutrition = cached.get("nutrition_report", {}) if cached else {}
        existing_subs = cached.get("substitutions", {}) if cached else {}
        # Merge existing subs with new user choices
        merged_subs = {**existing_subs, **selected_substitutions}

        save_recipe_cache(
            meal=cache_key,
            ingredients=updated,
            source="user_personalized",
            nutrition=existing_nutrition,       # ← preserve existing nutrition
            substitutions=merged_subs           # ← preserve + merge substitutions
        )

        print(f"[pipeline] Cache updated for '{meal}' with {len(selected_substitutions)} substitution(s)")


def run_grocery_pipeline(
    user_id:                str,
    weekly_meals:           dict  = None,
    manual_items:           list  = None,
    budget:                 float = 100,
    pantry_items:           list  = None,
    dietary_instruction:    str   = "Vegetarian only",
    mode:                   str   = "🍽️ Meal Only",
    selected_substitutions: dict  = None,
    user_lat: float = None,
    user_lng: float = None,
    force_refresh:          bool  = False,
):
    weekly_meals           = weekly_meals           or {}
    manual_items           = manual_items           or []
    pantry_items           = pantry_items           or []
    selected_substitutions = selected_substitutions or {}

    import time
    t0 = time.time()
    print(f"[pipeline] START")

    # =====================================================
    # STEP 1 — UNIFIED AI
    # =====================================================
    ai_result = run_unified_ai(
        weekly_meals=weekly_meals,
        manual_items=manual_items,
        dietary=dietary_instruction,
        force_refresh=force_refresh
    )
    print(f"[pipeline] STEP 1 done in {time.time() - t0:.1f}s")

    raw_nutrition    = ai_result.get("nutrition_report", {}) or {}
    nutrition_report = validate_nutrition(raw_nutrition)

    raw_shopping_list = ai_result.get("shopping_list", [])
    substitutions     = ai_result.get("substitutions", {}) or {}

    # =====================================================
    # STEP 2 — CLEAN + APPLY USER SUBSTITUTIONS
    # =====================================================
    shopping_list = clean_shopping_list([
        item.lower().strip()
        for item in raw_shopping_list
        if isinstance(item, str) and item.strip()
    ])
    print(f"[pipeline] STEP 2 done in {time.time() - t0:.1f}s")
    # Apply user's chosen substitutions to the list
    shopping_list = _apply_substitutions(
        shopping_list,
        selected_substitutions
    )
    print(f"[pipeline] Final shopping list: {len(shopping_list)} items")

    # =====================================================
    # STEP 3 — PERSIST SUBSTITUTIONS TO RECIPE CACHE
    # So next search for same meal returns personalized list
    # =====================================================
    if selected_substitutions:
        _persist_substitutions_to_cache(
            weekly_meals=weekly_meals,
            shopping_list=shopping_list,
            selected_substitutions=selected_substitutions,
            dietary=dietary_instruction
        )
    print(f"[pipeline] STEP 3 done in {time.time() - t0:.1f}s")
    # =====================================================
    # STEP 4 — PANTRY FILTER
    # =====================================================
    db_pantry_result = MCP_REGISTRY.execute("mongo", "get_pantry", {"user_id": user_id}) or {}
    db_pantry = db_pantry_result.get("items", []) if isinstance(db_pantry_result, dict) else []

    print(f"[pipeline] STEP 4 done in {time.time() - t0:.1f}s")
    print(f"[pipeline] DB pantry: {len(db_pantry)} items")
    ui_pantry = [p.lower().strip() for p in pantry_items if p]
    combined_pantry = set(p.lower().strip() for p in (db_pantry + ui_pantry) if isinstance(p, str))

    filtered_list = [
        item for item in shopping_list
        if item.lower() not in combined_pantry
    ]

    # =====================================================
    # STEP 5 — BUDGET OPTIMIZATION
    # =====================================================
    try:
        print(f"[pipeline] STEP 5 done in {time.time() - t0:.1f}s")
        budget_result = weekly_budget_planner(filtered_list, budget)
        print(f"[pipeline] Budget result: {budget_result}")
    except Exception as e:
        print(f"[pipeline] Budget failed: {e}")
        budget_result = {"optimization": {}}

    optimized_items = (
        budget_result.get("optimization", {}).get("optimized_list")
        or filtered_list
    )

    # =====================================================
    # STEP 6 — LOCATION
    # =====================================================
    loc = get_user_location(
        user_lat=user_lat,
        user_lng=user_lng
    ) or {}

    user_location = {
        "lat": loc.get("lat") or 0,
        "lng": loc.get("lng") or 0,
        "city": loc.get("city", ""),
        "region": loc.get("region", ""),
        "country": loc.get("country", "")
    }
    print(f"[pipeline] User location: {user_location}")
    print(f"[pipeline] Raw location response: {loc}")
    print(f"[pipeline] STEP 6 done in {time.time() - t0:.1f}s")
    if not user_location:
        return []

    lat = user_location.get("lat")
    lng = user_location.get("lng")
    print(f"[pipeline] Resolved lat/lng: {lat}, {lng}")

    if lat is None or lng is None:
        print("[store] invalid user location:", user_location)
        return []
    # =====================================================
    # STEP 7 — STORE FINDER
    # =====================================================
    try:
        store_results = clean_stores(
            recommend_best_store(user_location, optimized_items)
        )
        print(f"[pipeline] store_results: {len(store_results)}")
    except Exception as e:
        print(f"[pipeline] Store finder failed: {e}")
        store_results = []

    # =====================================================
    # STEP 8 — ROUTE
    # =====================================================
    try:
        top_stores = [r["store"] for r in store_results[:3]]
        route      = optimize_route(top_stores, user_location)
    except Exception:
        route = []

    # =====================================================
    # STEP 9 — SAVE TO MONGODB
    # =====================================================
    try:
        MCP_REGISTRY.execute(
            "mongo",
            "save_meal_plan",
            {
                "user_id":               user_id,
                "weekly_meals":          weekly_meals or {"manual": manual_items},
                "shopping_list":         filtered_list,
                "budget_summary":        budget_result,
                "nutrition_report":      nutrition_report,
                "selected_substitutions": selected_substitutions,  # ← saved too
            }
        )
        print(f"[pipeline] MCP file saved: {user_id},")
    except Exception as e:
        print(f"[pipeline] MCP save failed (non-fatal): {e}")

    # =====================================================
    # STEP 10 — FORMAT STORES
    # =====================================================
    formatted_stores = [
        {
            "store_name":    r["store"].get("name"),
            "lat":           r["store"].get("lat"),
            "lng":           r["store"].get("lng"),
            "basket_price":  r["score"].get("total_price", 0),
            "distance_km":   r["score"].get("distance_km", 0),
            "final_score":   r["score"].get("final_score", 0),
            "items":         r.get("items", []),
            "price_breakdown": r.get("price_breakdown", {}),
        }
        for r in store_results[:3]
    ]

    # =====================================================
    # STEP 11 — FORMAT ROUTE
    # =====================================================
    formatted_route = [
        {
            "stop":        i,
            "store_name":  s.get("name"),
            "lat":         s.get("lat"),
            "lng":         s.get("lng"),
            "distance_km": round(s.get("distance_km", 0), 1),
        }
        for i, s in enumerate(route, 1)
        if isinstance(s, dict)
    ]

    return {
        "shopping_list":           filtered_list,
        "nutrition_report":        nutrition_report,
        "budget_summary":          budget_result,
        "substitutions":           substitutions,
        "user_location":           user_location,
        "recommended_stores":      formatted_stores,
        "optimized_route":         formatted_route,
        "dietary_instruction":     dietary_instruction,
        "mode":                    mode,
        "applied_substitutions":   selected_substitutions,  # returned for UI confirmation
        "weekly_meals":            weekly_meals,
    }

def main():
    # all pipeline logic here
    run_grocery_pipeline('demo_user')

if __name__ == "__main__":
    main()