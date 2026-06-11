from backend.db.mongo_client import get_db
from datetime import datetime

db = get_db()
collection = db["recipe_cache"]


# =====================================================
# GET CACHE
# =====================================================
def get_cached_recipe(meal: str):
    if not meal:
        return None

    return collection.find_one({"meal": meal})


# =====================================================
# SAVE CACHE (FIXED)
# =====================================================
def save_recipe_cache(
    meal: str,
    ingredients: list,
    source: str,
    nutrition: dict = None,
    substitutions: dict = None   # ← added
):
    meal = " ".join(meal.strip().lower().split())  # normalize spaces
    if nutrition is None:
        nutrition = {}
    if substitutions is None:
        substitutions = {}
    print(f"save recipe cache: {meal}")
    try:
        collection.update_one(
            {"meal": meal},
            {
                "$set": {
                    "meal": meal,
                    "ingredients": ingredients or [],
                    "source": source,
                    "nutrition_report": nutrition,
                    "substitutions": substitutions,   # ← saved
                    "updated_at": datetime.utcnow()
                }
            },
            upsert=True
        )
        print(f"saved recipe cache: {meal}")

    except Exception as e:
        print(f"ERROR saving recipe cache for {meal}: {e}")

# =====================================================
# OPTIONAL: SAFE NORMALIZER (RECOMMENDED)
# =====================================================
def normalize_cache(doc: dict):
    """
    Ensures pipeline always gets safe structure
    """
    if not doc:
        return None

    return {
        "ingredients": doc.get("ingredients", []),
        "nutrition_report": doc.get("nutrition_report", {})
    }