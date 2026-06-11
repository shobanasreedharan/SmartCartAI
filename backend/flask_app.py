from flask import Flask, request, jsonify
from flask_cors import CORS
import traceback

try:
    from backend.core.mcp_bootstrap import init_mcp
    from backend.core.pipeline import run_grocery_pipeline
except Exception:
    # Relative imports may differ when running as module
    from core.mcp_bootstrap import init_mcp
    from core.pipeline import run_grocery_pipeline

app = Flask(__name__)
CORS(app)

@app.before_first_request
def startup():
    try:
        init_mcp()
    except Exception:
        # init may already have run or may fail in some dev contexts
        traceback.print_exc()

@app.route("/", methods=["GET"])
def home():
    return jsonify({"message": "Smart Grocery AI Flask API is running 🚀"})

@app.route("/generate", methods=["POST"])
def generate():
    try:
        payload = request.get_json(force=True)

        weekly_meals = payload.get("weekly_meals", {})
        manual_items = payload.get("manual_items", [])
        budget = payload.get("budget", 100)
        user_id = payload.get("user_id", "demo_user")
        pantry_items = payload.get("pantry_items", [])
        dietary_instruction = payload.get("dietary_instruction", "None")
        mode = payload.get("mode", "🍽️ Meal Only")

        if not weekly_meals and not manual_items:
            return jsonify({"detail": "Provide weekly_meals, manual_items, or both."}), 400

        result = run_grocery_pipeline(
            user_id=user_id,
            weekly_meals=weekly_meals,
            manual_items=manual_items,
            budget=budget,
            pantry_items=pantry_items,
            dietary_instruction=dietary_instruction,
            mode=mode,
        )

        return jsonify(result)

    except Exception as e:
        traceback.print_exc()
        return jsonify({"detail": str(e)}), 500

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=True)
