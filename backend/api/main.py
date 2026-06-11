from dotenv import load_dotenv
load_dotenv()

import os
import json
import httpx
import time
import traceback
from contextlib import asynccontextmanager
from typing import List, Dict

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from google.adk.runners import Runner
from google.adk.sessions import InMemorySessionService
from google.genai.types import Content, Part

from backend.agent.agent import create_agent
from backend.core.pipeline import run_grocery_pipeline

# ── Config ────────────────────────────────────────────────────────────────────
MCP_SERVER_URL = os.getenv(
    "MCP_SERVER_URL",
    "https://smartcart-mcp-505176174078.us-central1.run.app/mcp"
)

session_service = InMemorySessionService()
APP_NAME = "smartcart"
runner = None


# ── MCP helper (proper MCP protocol) ─────────────────────────────────────────
async def call_mcp_tool(tool_name: str, arguments: dict) -> dict:
    async with httpx.AsyncClient(timeout=30) as client:
        req_id = int(time.time() * 1000)

        # Step 1: Initialize
        init_res = await client.post(MCP_SERVER_URL,
            headers=[("Content-Type", "application/json"), ("Accept", "application/json, text/event-stream")],
            json={"jsonrpc": "2.0", "id": req_id, "method": "initialize",
                  "params": {"protocolVersion": "2024-11-05", "capabilities": {},
                             "clientInfo": {"name": "smartcart-agent", "version": "1.0"}}}
        )
        session_id = init_res.headers.get("mcp-session-id")
        if not session_id:
            raise ValueError(f"No session id. Headers: {dict(init_res.headers)}")

        # Step 2: Notify initialized
        await client.post(MCP_SERVER_URL,
            headers=[("Content-Type", "application/json"), ("Accept", "application/json, text/event-stream"), ("mcp-session-id", session_id)],
            json={"jsonrpc": "2.0", "method": "notifications/initialized"}
        )

        # Step 3: Call tool
        tool_res = await client.post(MCP_SERVER_URL,
            headers=[("Content-Type", "application/json"), ("Accept", "application/json, text/event-stream"), ("mcp-session-id", session_id)],
            json={"jsonrpc": "2.0", "id": req_id + 1, "method": "tools/call",
                  "params": {"name": tool_name, "arguments": arguments}}
        )
        print(f"[MCP] {tool_name} → {tool_res.status_code}: {tool_res.text[:500]}")
        print(f"[MCP] raw tool response: '{tool_res.text}'")

        for line in tool_res.text.splitlines():
            line = line.strip()
            if line.startswith("data: "):
                raw = line[6:].strip()
                if not raw or raw == "[DONE]":
                    continue
                data = json.loads(raw)
                if "error" in data:
                    raise ValueError(f"MCP tool error: {data['error']}")
                result = data.get("result", {})
                content = result.get("content", [])
                if content:
                    text = content[0].get("text", "")
                    if not text or not text.strip():
                        return {}
                    try:
                        return json.loads(text)
                    except json.JSONDecodeError:
                        return {"text": text}
        return {}

# ── Lifespan (ADK runner init) ────────────────────────────────────────────────
@asynccontextmanager
async def lifespan(app: FastAPI):
    global runner
    agent = create_agent()
    runner = Runner(
        agent=agent,
        app_name=APP_NAME,
        session_service=session_service,
    )
    yield


# ── App ───────────────────────────────────────────────────────────────────────
app = FastAPI(
    title="Smart Grocery AI",
    version="1.0.0",
    redirect_slashes=False,
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ── Models ────────────────────────────────────────────────────────────────────
class DishRequest(BaseModel):
    weekly_meals:           dict           = {}
    manual_items:           List[str]      = []
    budget:                 float          = 100
    user_id:                str            = "demo_user"
    pantry_items:           List[str]      = []
    dietary_instruction:    str            = "Vegetarian only"
    mode:                   str            = "🍽️ Meal Only"
    selected_substitutions: Dict[str, str] = {}
    user_lat: float | None = None
    user_lng: float | None = None
    force_refresh: bool = False

class ChatRequest(BaseModel):
    user_id:    str = "demo_user"
    session_id: str = "default"
    message:    str


# ── Routes ────────────────────────────────────────────────────────────────────
@app.get("/")
def home():
    return {"message": "Smart Grocery AI API is running 🚀"}


@app.get("/health")
def health():
    return {"status": "ok"}


@app.post("/generate")
def generate(request: DishRequest):
    try:
        if not request.weekly_meals and not request.manual_items:
            raise HTTPException(
                status_code=400,
                detail="Provide weekly_meals, manual_items, or both."
            )
        result = run_grocery_pipeline(
            user_id                = request.user_id,
            weekly_meals           = request.weekly_meals,
            manual_items           = request.manual_items,
            budget                 = request.budget,
            pantry_items           = request.pantry_items,
            dietary_instruction    = request.dietary_instruction,
            mode                   = request.mode,
            selected_substitutions = request.selected_substitutions,
            user_lat               = request.user_lat,
            user_lng               = request.user_lng,
            force_refresh          = request.force_refresh,
        )
        return result
    except HTTPException:
        raise
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/chat")
async def chat(req: ChatRequest):
    pantry_data = await call_mcp_tool("get_pantry_items", {"user_id": req.user_id})

    prompt = f"""You are SmartCart, an AI grocery and meal planning assistant.

The user's pantry contains: {pantry_data}

User question: {req.message}

Answer directly and concisely using the pantry data above."""

    from vertexai.generative_models import GenerativeModel
    model = GenerativeModel(os.getenv("GEMINI_MODEL_NAME", "gemini-2.5-flash"))
    response = model.generate_content(prompt)
    return {"response": response.text, "session_id": req.session_id}


@app.get("/debug/pantry/{user_id}")
async def debug_pantry(user_id: str):
    try:
        result = await call_mcp_tool("get_pantry_items", {"user_id": user_id})
        return {"result": result, "success": True}
    except Exception as e:
        return {"error": str(e), "success": False}

@app.put("/pantry/{user_id}")
async def update_pantry(user_id: str, body: dict):
    try:
        items = body.get("items", [])
        print(f"[pantry] updating {user_id}: {items}")
        result = await call_mcp_tool("update_pantry_items", {
            "user_id": user_id,
            "items": items
        })
        print(f"[update_pantry] result: {result}")
        return {"result": result, "success": True}
    except Exception as e:
        print(f"[update_pantry] failed: {e}")
        return {"error": str(e), "success": False}


@app.get("/debug/tools")
async def debug_tools():
    try:
        from google.adk.tools.mcp_tool import MCPToolset, StreamableHTTPConnectionParams
        toolset = MCPToolset(
            connection_params=StreamableHTTPConnectionParams(
                url=MCP_SERVER_URL,
                timeout=60,
            )
        )
        tools = await toolset.get_tools()
        return {"tools": [t.name for t in tools], "count": len(tools)}
    except Exception as e:
        return {"error": str(e)}