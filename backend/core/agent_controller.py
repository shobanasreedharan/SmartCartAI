from backend.mcp.mongo_tools import MongoMCPTools

class GroceryAgentController:

    def __init__(self, tools, memory, llm):
        self.tools = tools
        self.memory = memory
        self.llm = llm
        self.memory = MongoMCPTools()

    def run(self, user_id: str, weekly_meals: dict, budget: float):

        state = {
            "user_id": user_id,
            "weekly_meals": weekly_meals,
            "budget": budget,
            "step": 0,
            "context": {}
        }

        while state["step"] < 6:

            action = self.llm.decide_next_action(state)

            if action["type"] == "GET_INGREDIENTS":
                state["context"]["ingredients"] = self.tools.ingredients(state)

            elif action["type"] == "CHECK_PANTRY":
                state["context"]["pantry"] = self.tools.pantry(user_id)

            elif action["type"] == "OPTIMIZE_BUDGET":
                state["context"]["budget"] = self.tools.budget(state)

            elif action["type"] == "FIND_STORES":
                state["context"]["stores"] = self.tools.stores(state)

            elif action["type"] == "ROUTE":
                state["context"]["route"] = self.tools.route(state)

            elif action["type"] == "FINALIZE":
                break

            state["step"] += 1

        return self.tools.format_response(state)