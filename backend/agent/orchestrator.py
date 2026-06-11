from backend.core.registry import MCP_REGISTRY
from backend.services.weekly_engine import run_weekly_engine
from backend.optimization.budget_optimizer import weekly_budget_planner
from backend.services.store_finder import recommend_best_store
from backend.optimization.route_optimizer import optimize_route
from backend.services.location import get_user_location
from backend.utils.sanitizers import clean_shopping_list


class GroceryAgent:

    def run(self, user_id, weekly_meals, manual_items, pantry_items, budget):

        # =========================
        # 1. MEMORY TOOL (MCP)
        # =========================
        pantry = MCP_REGISTRY.execute(
            "mongo",
            "get_pantry",
            {"user_id": user_id}
        ) or []

        # =========================
        # 2. INGREDIENT GENERATION (AI TOOL)
        # =========================
        ai_result = run_weekly_engine(weekly_meals)
        ai_items = ai_result.get("shopping_list", [])

        # =========================
        # 3. MERGE + CLEAN
        # =========================
        combined = set(ai_items + manual_items)
        shopping_list = clean_shopping_list(list(combined))

        # =========================
        # 4. MEMORY FILTERING
        # =========================
        pantry_set = set([p.lower() for p in pantry + pantry_items])

        filtered = [
            i for i in shopping_list
            if i.lower() not in pantry_set
        ]

        # =========================
        # 5. BUDGET TOOL
        # =========================
        budget_result = weekly_budget_planner(filtered, budget)

        optimized = (
            budget_result.get("optimization", {}).get("optimized_list")
            or filtered
        )

        # =========================
        # 6. LOCATION TOOL
        # =========================
        location = get_user_location()

        # =========================
        # 7. STORE TOOL
        # =========================
        stores = recommend_best_store(location, optimized)

        if not stores:
            return self._fallback(filtered, budget_result)

        top = [s["store"] for s in stores[:3]]

        # =========================
        # 8. ROUTE TOOL
        # =========================
        route = optimize_route(top, location)

        # =========================
        # 9. SAVE MEMORY (MCP TOOL)
        # =========================
        MCP_REGISTRY.execute(
            "mongo",
            "save_meal_plan",
            {
                "user_id": user_id,
                "weekly_meals": weekly_meals,
                "shopping_list": filtered,
                "budget_summary": budget_result
            }
        )

        return {
            "shopping_list": filtered,
            "budget": budget_result,
            "route": route,
            "stores": stores[:3],
            "location": location
        }

    def _fallback(self, filtered, budget_result):
        return {
            "shopping_list": filtered,
            "budget": budget_result,
            "stores": [],
            "route": []
        }