from backend.db.mongo_client import get_db
from datetime import datetime

db = get_db()
collection = db["meal_plans"]


def save_meal_plan(
    user_id:          str,
    weekly_meals:     dict,
    shopping_list:    list,
    budget_summary:   dict = {},
    nutrition_report: dict = {},
):
    """
    Saves or updates a meal plan in MongoDB.
    Matches on user_id + normalized meal names to prevent duplicates.
    Called after every /generate and /regenerate request.
    """

    # Build a stable match key from meal names — normalize spaces/case
    meal_names = sorted([
        " ".join(str(v).strip().lower().split())
        for v in (weekly_meals or {}).values()
        if v
    ])
    meal_key = "|".join(meal_names) if meal_names else "manual"

    document = {
        "user_id":          user_id,
        "meal_key":         meal_key,
        "updated_at":       datetime.utcnow(),
        "weekly_meals":     weekly_meals,
        "shopping_list":    shopping_list,
        "budget_summary":   budget_summary,
        "nutrition_report": nutrition_report,
        "total_cost":       budget_summary.get("optimization", {}).get("optimized_cost", 0),
        "money_saved":      budget_summary.get("optimization", {}).get("money_saved", 0),
    }

    return collection.update_one(
        { "user_id": user_id, "meal_key": meal_key },  # match on user + normalized meal
        { "$set": document },
        upsert=True  # update if exists, insert if not
    )