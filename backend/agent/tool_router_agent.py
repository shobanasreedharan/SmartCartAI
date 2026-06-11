import json
from backend.core.registry import MCP_REGISTRY


class ToolRouterAgent:
    """
    Gemini-based tool selection agent (MCP orchestrator)
    """

    def __init__(self):
        self.model = "gemini-2.0-flash"

    # =====================================================
    # 1. PLAN TOOL CALL
    # =====================================================
    def decide(self, user_input: dict):

        prompt = f"""
You are an AI agent controlling MCP tools.

You must decide which tool to call.

AVAILABLE TOOLS:
1. mongo
   - get_pantry(user_id)
   - save_meal_plan(user_id, weekly_meals, shopping_list, budget_summary, nutrition_report)

2. weekly_engine
   - generate weekly shopping list from meals

RULES:
- Output ONLY valid JSON
- No explanation
- Choose ONLY ONE tool per step

User Input:
{json.dumps(user_input, indent=2)}

Return format:
{{
  "tool": "...",
  "action": "...",
  "payload": {{...}}
}}
"""

    # =====================================================
    # 2. EXECUTE TOOL VIA MCP
    # =====================================================
    def execute(self, plan: dict):

        tool = plan["tool"]
        action = plan["action"]
        payload = plan.get("payload", {})

        return MCP_REGISTRY.execute(tool, action, payload)

    # =====================================================
    # 3. FULL AGENT LOOP
    # =====================================================
    def run(self, user_input: dict):

        plan = self.decide(user_input)
        result = self.execute(plan)

        return {
            "plan": plan,
            "result": result
        }