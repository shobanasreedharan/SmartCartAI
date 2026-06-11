import { useState, useRef, useEffect } from "react";

const API_URL       = process.env.REACT_APP_API_URL       || "http://127.0.0.1:8000/generate";
const AGENT_URL     = process.env.REACT_APP_AGENT_URL     || "https://smartcart-agent-505176174078.us-central1.run.app/chat";

const T = {
  bg:        "#F7F5F0",
  surface:   "#FFFFFF",
  surfaceAlt:"#F2EFE9",
  border:    "#E0DDD6",
  borderDark:"#C8C4BC",
  ink:       "#1A1814",
  inkSec:    "#6B6760",
  inkTer:    "#9E9B96",
  green:     "#2D6A4F",
  greenLight:"#D8EDDF",
  greenMid:  "#52B788",
  amber:     "#B5600A",
  amberLight:"#FDEFD3",
  red:       "#C0392B",
  redLight:  "#FDECEA",
  blue:      "#1B4F8A",
  blueLight: "#DDEAF8",
};

const css = `
  @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,600;1,400&family=DM+Mono:wght@400;500&family=Lato:wght@300;400;700&display=swap');
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  body { background: ${T.bg}; color: ${T.ink}; font-family: 'Lato', sans-serif; line-height: 1.6; }
  ::-webkit-scrollbar { width: 5px; }
  ::-webkit-scrollbar-track { background: ${T.bg}; }
  ::-webkit-scrollbar-thumb { background: ${T.borderDark}; border-radius: 3px; }
  @keyframes fadeUp { from { opacity:0; transform:translateY(20px); } to { opacity:1; transform:translateY(0); } }
  @keyframes spin { to { transform: rotate(360deg); } }
  @keyframes slideIn { from { opacity:0; transform:translateX(20px); } to { opacity:1; transform:translateX(0); } }
  @keyframes pulse { 0%,100% { opacity:1; } 50% { opacity:0.4; } }
  .fu  { animation: fadeUp 0.5s ease both; }
  .fu1 { animation: fadeUp 0.5s 0.05s ease both; }
  .fu2 { animation: fadeUp 0.5s 0.10s ease both; }
  .fu3 { animation: fadeUp 0.5s 0.15s ease both; }
  .chat-panel { animation: slideIn 0.25s ease both; }
  .chat-msg-user { animation: fadeUp 0.2s ease both; }
  .chat-msg-agent { animation: fadeUp 0.2s ease both; }
`;

// ── Shared UI ────────────────────────────────────────────────────

function Label({ children }) {
  return <span style={{ display:"block", fontSize:11, fontWeight:700, letterSpacing:"0.06em", textTransform:"uppercase", color:T.inkSec, marginBottom:5 }}>{children}</span>;
}

function Input({ label, value, onChange, placeholder, type="text" }) {
  const [f, setF] = useState(false);
  return (
    <label style={{ display:"flex", flexDirection:"column", gap:4 }}>
      {label && <Label>{label}</Label>}
      <input type={type} value={value} onChange={onChange} placeholder={placeholder}
        onFocus={()=>setF(true)} onBlur={()=>setF(false)}
        style={{ background:T.surfaceAlt, border:`1px solid ${f?T.ink:T.border}`, borderRadius:4, padding:"10px 12px", fontSize:14, color:T.ink, fontFamily:"'Lato',sans-serif", outline:"none", width:"100%", transition:"border-color 0.15s" }} />
    </label>
  );
}

function Textarea({ label, value, onChange, placeholder, rows=3 }) {
  const [f, setF] = useState(false);
  return (
    <label style={{ display:"flex", flexDirection:"column", gap:4 }}>
      {label && <Label>{label}</Label>}
      <textarea value={value} onChange={onChange} placeholder={placeholder} rows={rows}
        onFocus={()=>setF(true)} onBlur={()=>setF(false)}
        style={{ background:T.surfaceAlt, border:`1px solid ${f?T.ink:T.border}`, borderRadius:4, padding:"10px 12px", fontSize:14, color:T.ink, fontFamily:"'Lato',sans-serif", outline:"none", width:"100%", resize:"vertical", transition:"border-color 0.15s" }} />
    </label>
  );
}

function Select({ label, value, onChange, options }) {
  return (
    <label style={{ display:"flex", flexDirection:"column", gap:4 }}>
      {label && <Label>{label}</Label>}
      <select value={value} onChange={onChange}
        style={{ background:T.surfaceAlt, border:`1px solid ${T.border}`, borderRadius:4, padding:"10px 12px", fontSize:14, color:T.ink, fontFamily:"'Lato',sans-serif", outline:"none", width:"100%" }}>
        {options.map(o => <option key={o} value={o}>{o}</option>)}
      </select>
    </label>
  );
}

function Card({ children, style, className="" }) {
  return <div className={className} style={{ background:T.surface, border:`1px solid ${T.border}`, borderRadius:8, padding:"1.5rem", ...style }}>{children}</div>;
}

function SectionHead({ label, sub, delay="" }) {
  return (
    <div className={delay ? `fu${delay}` : ""} style={{ marginBottom:"1.25rem" }}>
      <h2 style={{ fontFamily:"'Playfair Display',serif", fontSize:22, fontWeight:600, letterSpacing:"-0.02em", marginBottom:2 }}>{label}</h2>
      {sub && <p style={{ fontSize:13, color:T.inkSec }}>{sub}</p>}
      <div style={{ width:40, height:2, background:T.green, marginTop:8 }} />
    </div>
  );
}

function ScoreBar({ label, value, max=10, color=T.green }) {
  return (
    <div style={{ marginBottom:10 }}>
      <div style={{ display:"flex", justifyContent:"space-between", marginBottom:4 }}>
        <span style={{ fontSize:13 }}>{label}</span>
        <span style={{ fontFamily:"'DM Mono',monospace", fontSize:13, color }}>{value}/{max}</span>
      </div>
      <div style={{ height:6, background:T.surfaceAlt, borderRadius:3, overflow:"hidden" }}>
        <div style={{ height:"100%", borderRadius:3, width:`${(value/max)*100}%`, background:color, transition:"width 1s ease" }} />
      </div>
    </div>
  );
}

function ModeBtn({ active, onClick, children }) {
  return (
    <button onClick={onClick} style={{ padding:"7px 16px", borderRadius:4, border:`1px solid ${active?T.ink:T.border}`, background:active?T.ink:"transparent", color:active?"#FFF":T.inkSec, fontSize:12, fontWeight:700, letterSpacing:"0.04em", textTransform:"uppercase", cursor:"pointer", fontFamily:"'Lato',sans-serif", transition:"all 0.15s" }}>
      {children}
    </button>
  );
}

function TabBtn({ active, onClick, children }) {
  return (
    <button onClick={onClick} style={{ padding:"8px 18px", borderRadius:4, whiteSpace:"nowrap", border:`1px solid ${active?T.ink:T.border}`, background:active?T.ink:"transparent", color:active?"#FFF":T.inkSec, fontSize:12, fontWeight:700, letterSpacing:"0.04em", textTransform:"uppercase", cursor:"pointer", fontFamily:"'Lato',sans-serif", transition:"all 0.15s" }}>
      {children}
    </button>
  );
}

const DAYS    = ["Monday","Tuesday","Wednesday","Thursday","Friday","Saturday","Sunday"];
const DIETS   = ["None","Vegetarian","Vegan","Keto","High Protein","Low Carb"];
const TABS    = [
  { id:"list",      label:"Shopping List"  },
  { id:"stores",    label:"Store Prices"   },
  { id:"route",     label:"Route"          },
  { id:"nutrition", label:"Nutrition"      },
  { id:"subs",      label:"Substitutions"  },
  { id:"budget",    label:"Budget"         },
];

const CHAT_SUGGESTIONS = [
  "What's in my pantry?",
  "Suggest a vegetarian meal",
  "What can I cook with rice and oil?",
  "Save my current meal plan",
];

// ── Price matrix helper ──────────────────────────────────────────
function buildMatrix(stores) {
  const allItems = new Set();
  stores.forEach(s => (s.items||[]).forEach(i => allItems.add(i.item)));
  const items = [...allItems].sort();

  const matrix = {}, totals = {};
  stores.forEach(s => {
    const n = s.store_name;
    totals[n] = 0; matrix[n] = {};
    (s.items||[]).forEach(i => { matrix[n][i.item]=i.price; totals[n]+=i.price; });
  });

  const wCounts={}, wTotals={};
  items.forEach(item => {
    let minP=Infinity, minS=null;
    stores.forEach(s => { const p=matrix[s.store_name]?.[item]; if(p!==undefined&&p<minP){minP=p;minS=s.store_name;} });
    if(minS){ wCounts[minS]=(wCounts[minS]||0)+1; wTotals[minS]=(wTotals[minS]||0)+minP; }
  });

  return { items, matrix, totals, wCounts, wTotals, overallCheapest: Object.values(wTotals).reduce((a,b)=>a+b,0) };
}

// ── Chat Panel Component ─────────────────────────────────────────
function ChatPanel({ onClose }) {
  const [messages,    setMessages]    = useState([
    { role:"agent", text:"Hi! I'm your SmartCart AI assistant. I can check your pantry, suggest meals, and help plan your groceries. What would you like to know?" }
  ]);
  const [input,       setInput]       = useState("");
  const [loading,     setChatLoading] = useState(false);
  const [sessionId]                   = useState(() => `session_${Date.now()}`);
  const messagesEndRef                = useRef(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior:"smooth" });
  }, [messages]);

  const sendMessage = async (text) => {
    const msg = text || input.trim();
    if (!msg) return;

    setMessages(prev => [...prev, { role:"user", text: msg }]);
    setInput("");
    setChatLoading(true);

    try {
      const res = await fetch(AGENT_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message:    msg,
          user_id:    "demo_user",
          session_id: sessionId,
        }),
      });
      const json = await res.json();
      setMessages(prev => [...prev, { role:"agent", text: json.response || "Sorry, I didn't get a response." }]);
    } catch(e) {
      setMessages(prev => [...prev, { role:"agent", text: "⚠ Connection error. Please try again.", isError: true }]);
    } finally {
      setChatLoading(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); }
  };

  return (
    <div className="chat-panel" style={{
      position: "fixed", top: 0, right: 0, width: 380, height: "100vh",
      background: T.surface, borderLeft: `1px solid ${T.border}`,
      display: "flex", flexDirection: "column", zIndex: 1000,
      boxShadow: "-4px 0 24px rgba(0,0,0,0.08)",
    }}>
      {/* Header */}
      <div style={{
        padding: "1rem 1.25rem", borderBottom: `1px solid ${T.border}`,
        display: "flex", alignItems: "center", justifyContent: "space-between",
        background: T.ink, color: "#FFF", flexShrink: 0,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: 20 }}>🤖</span>
          <div>
            <div style={{ fontFamily: "'Playfair Display',serif", fontSize: 15, letterSpacing: "-0.01em" }}>
              SmartCart <em style={{ fontWeight: 400, color: T.greenMid }}>Agent</em>
            </div>
            <div style={{ fontSize: 10, opacity: 0.5, letterSpacing: "0.08em", textTransform: "uppercase" }}>
              Powered by Gemini + ADK
            </div>
          </div>
        </div>
        <button onClick={onClose} style={{
          background: "transparent", border: "none", color: "#FFF",
          fontSize: 20, cursor: "pointer", opacity: 0.7, lineHeight: 1,
          padding: "4px 8px", borderRadius: 4,
        }}>✕</button>
      </div>

      {/* Messages */}
      <div style={{ flex: 1, overflowY: "auto", padding: "1rem", display: "flex", flexDirection: "column", gap: 12 }}>
        {messages.map((msg, i) => (
          <div key={i} className={msg.role === "user" ? "chat-msg-user" : "chat-msg-agent"}
            style={{ display: "flex", justifyContent: msg.role === "user" ? "flex-end" : "flex-start" }}>
            <div style={{
              maxWidth: "85%", padding: "10px 14px", borderRadius: msg.role === "user" ? "12px 12px 2px 12px" : "12px 12px 12px 2px",
              background: msg.role === "user" ? T.ink : msg.isError ? T.redLight : T.surfaceAlt,
              color: msg.role === "user" ? "#FFF" : msg.isError ? T.red : T.ink,
              fontSize: 13, lineHeight: 1.6,
              border: `1px solid ${msg.role === "user" ? "transparent" : msg.isError ? T.red+"33" : T.border}`,
            }}>
              {msg.text}
            </div>
          </div>
        ))}

        {/* Typing indicator */}
        {loading && (
          <div style={{ display: "flex", justifyContent: "flex-start" }}>
            <div style={{
              padding: "10px 14px", borderRadius: "12px 12px 12px 2px",
              background: T.surfaceAlt, border: `1px solid ${T.border}`,
              display: "flex", gap: 5, alignItems: "center",
            }}>
              {[0,1,2].map(i => (
                <div key={i} style={{
                  width: 6, height: 6, borderRadius: "50%", background: T.inkTer,
                  animation: `pulse 1.2s ${i*0.2}s ease infinite`,
                }} />
              ))}
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Suggestions — show only at start */}
      {messages.length === 1 && (
        <div style={{ padding: "0 1rem 0.75rem", display: "flex", flexWrap: "wrap", gap: 6, flexShrink: 0 }}>
          {CHAT_SUGGESTIONS.map((s, i) => (
            <button key={i} onClick={() => sendMessage(s)} style={{
              fontSize: 11, padding: "4px 10px", borderRadius: 20,
              border: `1px solid ${T.border}`, background: T.surfaceAlt,
              color: T.inkSec, cursor: "pointer", fontFamily: "'Lato',sans-serif",
              fontWeight: 700, transition: "all 0.15s",
            }}>{s}</button>
          ))}
        </div>
      )}

      {/* Input */}
      <div style={{
        padding: "0.75rem 1rem", borderTop: `1px solid ${T.border}`,
        display: "flex", gap: 8, flexShrink: 0, background: T.surface,
      }}>
        <textarea
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Ask about your pantry, meals, or grocery list…"
          rows={2}
          style={{
            flex: 1, background: T.surfaceAlt, border: `1px solid ${T.border}`,
            borderRadius: 6, padding: "8px 12px", fontSize: 13,
            color: T.ink, fontFamily: "'Lato',sans-serif", outline: "none",
            resize: "none", lineHeight: 1.5,
          }}
        />
        <button
          onClick={() => sendMessage()}
          disabled={loading || !input.trim()}
          style={{
            width: 40, height: 40, alignSelf: "flex-end", borderRadius: 6,
            background: loading || !input.trim() ? T.borderDark : T.green,
            border: "none", color: "#FFF", fontSize: 16, cursor: loading || !input.trim() ? "not-allowed" : "pointer",
            display: "flex", alignItems: "center", justifyContent: "center",
            transition: "background 0.15s", flexShrink: 0,
          }}
        >↑</button>
      </div>
    </div>
  );
}

// ── Main App ─────────────────────────────────────────────────────
export default function SmartCartAI() {
  const [mode,        setMode]        = useState("meal");
  const [planType,    setPlanType]    = useState("single");
  const [dish,        setDish]        = useState("");
  const [weeklyMeals, setWeeklyMeals] = useState({});
  const [manualText,  setManualText]  = useState("");
  const [pantryText,  setPantryText]  = useState("");
  const [dietary,     setDietary]     = useState("None");
  const [loading,     setLoading]     = useState(false);
  const [error,       setError]       = useState(null);
  const [data,        setData]        = useState(null);
  const [activeTab,   setActiveTab]   = useState("list");
  const [selectedSubs,    setSelectedSubs]    = useState({});
  const [regenLoading,    setRegenLoading]    = useState(false);
  const [regenMsg,        setRegenMsg]        = useState(null);
  const [chatOpen,        setChatOpen]        = useState(false);
  const [userLatLng,      setUserLatLng]      = useState(null);
  const resultsRef = useRef(null);
  const lastPayloadRef = useRef(null); // stores last generate payload for regen

  // Request browser geolocation once on mount
  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => setUserLatLng({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
        () => {} // silently fall back — backend will use IP geo
      );
    }
  }, []);

  // Fetch pantry from backend on mount and pre-fill the form field
  useEffect(() => {
    const baseUrl = (process.env.REACT_APP_API_URL || "http://127.0.0.1:8000/generate")
      .replace("/generate", "");
    fetch(`${baseUrl}/debug/pantry/demo_user`)
      .then(r => r.json())
      .then(json => {
        // result is {"user_id":..., "items":[...], "count":...}
        const raw = json?.result?.items ?? json?.result;
        if (!raw) return;
        const items = Array.isArray(raw)
          ? raw.map(i => (typeof i === "string" ? i : i?.name || i?.item || "")).filter(Boolean)
          : typeof raw === "string"
          ? raw.split(",").map(s => s.trim()).filter(Boolean)
          : [];
        if (items.length) setPantryText(items.join(", "));
      })
      .catch(() => {}); // silently ignore — pantry field just stays empty
  }, []);

  // Sync pantry field contents to MongoDB after generate/regenerate
  const syncPantry = (items) => {
    if (!items || !items.length) return;
    const baseUrl = (process.env.REACT_APP_API_URL || "http://127.0.0.1:8000/generate")
      .replace("/generate", "");
    fetch(`${baseUrl}/pantry/demo_user`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ items }),
    }).catch(() => {}); // fire-and-forget — don't block the UI
  };

  const handleRegenerate = async () => {
    if (!data) return;
    setRegenLoading(true);
    setRegenMsg(null);

    // Normalize sub keys to lowercase for case-insensitive matching
    const normalizedSubs = Object.fromEntries(
      Object.entries(selectedSubs)
        .filter(([, v]) => v && v !== "Keep original")
        .map(([k, v]) => [k.toLowerCase().trim(), v])
    );

    // Match each shopping list item case-insensitively
    // handles mismatches like "Heavy Cream" vs "heavy cream" or "1 cup heavy cream"
    const updatedList = (data.shopping_list || []).map(item => {
      const itemLower = item.toLowerCase().trim();
      const matchedKey = Object.keys(normalizedSubs).find(
        key => itemLower === key || itemLower.includes(key) || key.includes(itemLower)
      );
      return matchedKey ? normalizedSubs[matchedKey] : item;
    });

    const pantryItems = pantryText.split(",").map(x=>x.trim().toLowerCase()).filter(Boolean);

    try {
      // Reuse the exact same payload from the original generate call
      // so weekly_meals, mode, dietary etc are all preserved
      const basePayload = lastPayloadRef.current || {};
      const regenPayload = {
        ...basePayload,
        manual_items:           updatedList,
        pantry_items:           pantryItems,
        selected_substitutions: Object.fromEntries(
          Object.entries(selectedSubs).filter(([,v]) => v && v !== "Keep original")
        ),
        force_refresh: true,
      };
      const res = await fetch(API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(regenPayload)
      });

      if (!res.ok) throw new Error(await res.text());
      const json = await res.json();
      const savedCount = activeSubCount; // capture before clearing
      setData(json);
      setSelectedSubs({});
      setActiveTab("list");
      setRegenMsg(`✓ Plan regenerated! ${savedCount} substitution(s) saved to your profile — future plans for the same meals will use your preferences automatically.`);
      resultsRef.current?.scrollIntoView({ behavior: "smooth" });
    } catch(e) {
      setRegenMsg(`⚠ Regeneration failed: ${e.message}`);
    } finally {
      setRegenLoading(false);
    }
  };

  const activeSubCount = Object.values(selectedSubs).filter(v => v && v !== "Keep original").length;

  const handleGenerate = async () => {
    setError(null); setData(null); setLoading(true);

    const manualItems = manualText.split(",").map(x=>x.trim().toLowerCase()).filter(Boolean);
    const pantryItems = pantryText.split(",").map(x=>x.trim().toLowerCase()).filter(Boolean);

    let weekly = {};
    if (mode !== "list") {
      if (planType === "single" && dish.trim()) {
        weekly = { "single_meal": dish.trim() };
      } else {
        weekly = Object.fromEntries(Object.entries(weeklyMeals).filter(([,v])=>v.trim()));
      }
    }

    if (!Object.keys(weekly).length && !manualItems.length) {
      setError("Please enter a meal or shopping items."); setLoading(false); return;
    }

    try {
      const modeStr = mode==="meal" ? "🍽️ Single Meal"
                    : mode==="weekly" ? "📅 Weekly Meals"
                    : mode==="list"  ? "🛍️ Shopping List Only"
                    : "🍽️ + 🛍️ Meal & Shopping List";

      const payload = { weekly_meals:weekly, manual_items:manualItems, budget:100, pantry_items:pantryItems, dietary_instruction:dietary, mode:modeStr, ...(userLatLng ? { user_lat: userLatLng.lat, user_lng: userLatLng.lng } : {}) };
      lastPayloadRef.current = payload; // save for regenerate
      const res = await fetch(API_URL, {
        method:"POST", headers:{"Content-Type":"application/json"},
        body: JSON.stringify(payload)
      });

      if (!res.ok) throw new Error(await res.text());
      const json = await res.json();
      // Small buffer ensures React fully commits data state before any tab renders
      await new Promise(res => setTimeout(res, 100));
      setData(json); setActiveTab("list");
      syncPantry(pantryItems);
      setTimeout(() => resultsRef.current?.scrollIntoView({ behavior:"smooth" }), 100);
    } catch(e) {
      setError(e.message || "Something went wrong.");
    } finally {
      setLoading(false);
    }
  };

  const stores    = data?.recommended_stores ?? [];
  const route     = data?.optimized_route    ?? [];
  const list      = data?.shopping_list      ?? [];
  const subs      = data?.substitutions      ?? {};
  const loc       = data?.user_location      ?? {};
  const nutr      = data?.nutrition_report   ?? {};
  const scores    = nutr.nutrition_scores    ?? {};
  const feedback  = nutr.ai_feedback         ?? {};
  const budgetOpt = data?.budget_summary?.optimization ?? {};
  const pm        = stores.length ? buildMatrix(stores) : null;

  // Budget tab figures — always in sync with Store Prices tab
  // "Without Optimization" = most expensive single store (worst case)
  // "With Optimization"    = multi-store cheapest basket (best case)
  const pmExpensiveStore  = pm ? Object.entries(pm.totals).sort((a,b)=>b[1]-a[1])[0]?.[0] : null;
  const pmCheapestStore   = pm ? Object.entries(pm.totals).sort((a,b)=>a[1]-b[1])[0]?.[0] : null;
  const pmOriginalCost    = pm && pmExpensiveStore ? pm.totals[pmExpensiveStore].toFixed(2) : (budgetOpt.original_cost  ?? 0);
  const pmOptimizedCost   = pm ? pm.overallCheapest.toFixed(2)                             : (budgetOpt.optimized_cost ?? 0);
  const pmMoneySaved      = Math.max(0, parseFloat(pmOriginalCost) - parseFloat(pmOptimizedCost)).toFixed(2);

  return (
    <>
      <style>{css}</style>

      {/* Header */}
      <header style={{ background:T.ink, color:"#FFF", padding:"1rem 2rem", display:"flex", alignItems:"center", justifyContent:"space-between", position:"sticky", top:0, zIndex:100 }}>
        <div style={{ display:"flex", alignItems:"center", gap:14 }}>
          <span style={{ fontSize:24 }}>🛒</span>
          <div>
            <div style={{ fontFamily:"'Playfair Display',serif", fontSize:20, letterSpacing:"-0.01em" }}>
              SmartCart <em style={{ fontWeight:400, color:T.greenMid }}>AI</em>
            </div>
            <div style={{ fontSize:10, letterSpacing:"0.12em", opacity:0.5, textTransform:"uppercase" }}>Grocery Intelligence</div>
          </div>
        </div>
        <div style={{ display:"flex", alignItems:"center", gap:16 }}>
          {loc.city && <div style={{ fontSize:12, opacity:0.7 }}>📍 {loc.city}, {loc.region}</div>}
          <button onClick={() => setChatOpen(o => !o)} style={{
            display: "flex", alignItems: "center", gap: 8,
            padding: "8px 16px", borderRadius: 6,
            background: chatOpen ? T.greenMid : "rgba(255,255,255,0.1)",
            border: `1px solid ${chatOpen ? T.greenMid : "rgba(255,255,255,0.2)"}`,
            color: "#FFF", fontSize: 12, fontWeight: 700,
            letterSpacing: "0.04em", textTransform: "uppercase",
            cursor: "pointer", fontFamily: "'Lato',sans-serif",
            transition: "all 0.15s",
          }}>
            <span style={{ fontSize: 16 }}>🤖</span>
            AI Agent
          </button>
        </div>
      </header>

      {/* Main content — shift left when chat is open */}
      <div style={{
        marginRight: chatOpen ? 380 : 0,
        transition: "margin-right 0.25s ease",
        maxWidth: chatOpen ? "none" : 1080,
        margin: chatOpen ? "0" : "0 auto",
        padding: "2rem 1.5rem",
      }}>
        <div style={{ maxWidth: chatOpen ? 800 : "none", margin: "0 auto" }}>

        {/* Input Card */}
        <Card className="fu" style={{ marginBottom:"2rem" }}>
          <SectionHead label="Plan Your Groceries" sub="AI builds your optimized shopping plan" />

          {/* Mode */}
          <div style={{ display:"flex", gap:8, marginBottom:"1.5rem", flexWrap:"wrap" }}>
            <ModeBtn active={mode==="meal"}   onClick={()=>setMode("meal")}>🍽️ Single Meal</ModeBtn>
            <ModeBtn active={mode==="weekly"} onClick={()=>setMode("weekly")}>📅 Weekly Plan</ModeBtn>
            <ModeBtn active={mode==="list"}   onClick={()=>setMode("list")}>🛍️ Shopping List</ModeBtn>
            <ModeBtn active={mode==="both"}   onClick={()=>setMode("both")}>🍽️ + 🛍️ Both</ModeBtn>
          </div>

          {(mode==="meal") && (
            <div style={{ marginBottom:"1.25rem" }}>
              <Input label="Enter one meal" value={dish} onChange={e=>setDish(e.target.value)} placeholder="e.g. Tomato Veg Pasta" />
            </div>
          )}

          {(mode==="weekly") && (
            <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(220px,1fr))", gap:10, marginBottom:"1.25rem" }}>
              {DAYS.map(day => (
                <Input key={day} label={day} value={weeklyMeals[day]??""} onChange={e=>setWeeklyMeals(p=>({...p,[day]:e.target.value}))} placeholder="Enter meal..." />
              ))}
            </div>
          )}

          {(mode==="both") && (
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"1rem", marginBottom:"1.25rem" }}>
              <Input label="Enter meal" value={dish} onChange={e=>setDish(e.target.value)} placeholder="e.g. Lentil Curry" />
              <Textarea label="Extra items (comma separated)" value={manualText} onChange={e=>setManualText(e.target.value)} placeholder="bread, yogurt, juice..." rows={2} />
            </div>
          )}

          {(mode==="list") && (
            <div style={{ marginBottom:"1.25rem" }}>
              <Textarea label="Shopping items (comma separated)" value={manualText} onChange={e=>setManualText(e.target.value)} placeholder="tomatoes, olive oil, pasta, spinach..." rows={3} />
            </div>
          )}

          <div style={{ height:1, background:T.border, margin:"1.25rem 0" }} />

          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"1rem", marginBottom:"1.25rem" }}>
            <Textarea label="Pantry items — already at home (comma separated)" value={pantryText} onChange={e=>setPantryText(e.target.value)} placeholder="salt, oil, garlic..." rows={2} />
            <Select label="Dietary Preference" value={dietary} onChange={e=>setDietary(e.target.value)} options={DIETS} />
          </div>

          <button onClick={handleGenerate} disabled={loading} style={{ width:"100%", padding:"14px", background:loading?T.borderDark:T.ink, color:"#FFF", border:"none", borderRadius:4, fontSize:14, fontWeight:700, letterSpacing:"0.04em", textTransform:"uppercase", cursor:loading?"not-allowed":"pointer", fontFamily:"'Lato',sans-serif", transition:"background 0.15s", opacity:loading?0.7:1 }}>
            {loading ? "Generating Plan…" : "✦ Generate Smart Plan"}
          </button>

          {error && <div style={{ marginTop:"1rem", padding:"12px 16px", borderRadius:6, background:T.redLight, border:`1px solid #f5c6c3`, color:T.red, fontSize:13 }}>⚠ {error}</div>}
        </Card>

        {loading && (
          <Card style={{ textAlign:"center", padding:"3rem" }}>
            <div style={{ width:40, height:40, margin:"0 auto 1rem", border:`3px solid ${T.border}`, borderTop:`3px solid ${T.green}`, borderRadius:"50%", animation:"spin 0.8s linear infinite" }} />
            <p style={{ color:T.inkSec, fontFamily:"'Playfair Display',serif", fontStyle:"italic" }}>Building your grocery plan…</p>
          </Card>
        )}

        {data && !loading && (
          <div ref={resultsRef}>

            <div style={{ display:"flex", gap:4, marginBottom:"1.25rem", overflowX:"auto", paddingBottom:2 }}>
              {TABS.map(t => <TabBtn key={t.id} active={activeTab===t.id} onClick={()=>setActiveTab(t.id)}>{t.label}</TabBtn>)}
            </div>

            {activeTab==="list" && (
              <Card className="fu1">
                <SectionHead label="Compiled Shopping List" sub={`${list.length} items`} delay="1" />
                {!list.length ? <p style={{ color:T.inkSec }}>No items generated.</p> : (
                  <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(200px,1fr))", gap:8 }}>
                    {list.map((item,i) => (
                      <div key={i} style={{ display:"flex", alignItems:"center", gap:10, padding:"10px 14px", borderRadius:6, background:T.surfaceAlt, border:`1px solid ${T.border}` }}>
                        <span style={{ color:T.green, fontWeight:700 }}>✓</span>
                        <span style={{ fontSize:13, textTransform:"capitalize" }}>{item}</span>
                      </div>
                    ))}
                  </div>
                )}
              </Card>
            )}

            {activeTab==="stores" && (
              <div className="fu1">
                {!stores.length ? <Card><p style={{ color:T.inkSec }}>No stores found.</p></Card> : pm && (
                  <>
                    {(() => {
                      const sortedStores = [...stores].sort(
                        (a,b) => (pm.totals[a.store_name]||Infinity) - (pm.totals[b.store_name]||Infinity)
                      );
                      const cheapestTotal = pm.totals[sortedStores[0]?.store_name] || 0;
                      return (
                        <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(200px,1fr))", gap:12, marginBottom:"1.25rem" }}>
                          {sortedStores.map((store, i) => {
                            const name       = store.store_name;
                            const total      = pm.totals[name] || 0;
                            const isCheapest = i === 0;
                            const itemsWon   = pm.wCounts[name] || 0;
                            const rank       = i === 0 ? "🥇 Cheapest Basket" : i === 1 ? "🥈 Runner Up" : "🥉 Option 3";
                            const savings    = total - cheapestTotal;
                            return (
                              <Card key={name} style={{ borderColor: isCheapest ? T.green : T.border }}>
                                <span style={{ display:"inline-block", marginBottom:8, fontSize:11, fontWeight:700, letterSpacing:"0.06em", textTransform:"uppercase", padding:"2px 8px", borderRadius:3, background: isCheapest ? T.greenLight : T.surfaceAlt, color: isCheapest ? T.green : T.inkSec }}>{rank}</span>
                                <div style={{ fontFamily:"'Playfair Display',serif", fontSize:16, marginBottom:4 }}>{name}</div>
                                <div style={{ fontFamily:"'DM Mono',monospace", fontSize:22, fontWeight:500, color: isCheapest ? T.green : T.ink, marginBottom:2 }}>${total.toFixed(2)}</div>
                                {!isCheapest && savings > 0 && <div style={{ fontSize:12, color:T.red, marginBottom:4 }}>+${savings.toFixed(2)} vs cheapest</div>}
                                <span style={{ fontSize:12, color:T.inkSec }}>{itemsWon > 0 ? `${itemsWon} cheapest items` : "No cheapest items"}</span>
                              </Card>
                            );
                          })}
                        </div>
                      );
                    })()}
                    {(() => {
                      const minStoreTotal = Math.min(...stores.map(s => pm.totals[s.store_name] || Infinity));
                      const savings = minStoreTotal - pm.overallCheapest;
                      return (
                        <div style={{ background:T.greenLight, border:`1px solid ${T.green}33`, borderRadius:8, padding:"1rem 1.25rem", marginBottom:"1.25rem", display:"flex", alignItems:"center", gap:12 }}>
                          <span style={{ fontSize:22 }}>🏆</span>
                          <div>
                            <div style={{ fontSize:11, fontWeight:700, color:T.green, letterSpacing:"0.06em", textTransform:"uppercase" }}>Cheapest Possible Basket (Multi-Store)</div>
                            <div style={{ fontFamily:"'DM Mono',monospace", fontSize:24, fontWeight:500, color:T.green }}>${pm.overallCheapest.toFixed(2)}</div>
                            <div style={{ fontSize:12, color:T.green }}>Buy each item at its cheapest store{savings > 0.01 && ` — saves $${savings.toFixed(2)} vs single store`}</div>
                          </div>
                        </div>
                      );
                    })()}
                    <Card>
                      <SectionHead label="Price Comparison Table" sub="Green = cheapest for that item" delay="1" />
                      <div style={{ overflowX:"auto" }}>
                        <table style={{ width:"100%", borderCollapse:"collapse", fontSize:13 }}>
                          <thead>
                            <tr>
                              <th style={{ textAlign:"left", padding:"8px 12px", borderBottom:`2px solid ${T.border}`, fontSize:11, fontWeight:700, letterSpacing:"0.04em", textTransform:"uppercase", color:T.inkSec }}>Item</th>
                              {stores.map(s => <th key={s.store_name} style={{ textAlign:"right", padding:"8px 12px", borderBottom:`2px solid ${T.border}`, fontSize:11, fontWeight:700, letterSpacing:"0.04em", textTransform:"uppercase", color:T.inkSec, whiteSpace:"nowrap" }}>{s.store_name}</th>)}
                            </tr>
                          </thead>
                          <tbody>
                            {pm.items.map((item,ri) => {
                              const rowPrices = stores.map(s=>pm.matrix[s.store_name]?.[item]);
                              const minP = Math.min(...rowPrices.filter(p=>p!==undefined));
                              return (
                                <tr key={item} style={{ background:ri%2===0?T.surfaceAlt:T.surface }}>
                                  <td style={{ padding:"8px 12px", textTransform:"capitalize", fontWeight:500 }}>{item}</td>
                                  {stores.map(s => {
                                    const p = pm.matrix[s.store_name]?.[item];
                                    const isMin = p===minP;
                                    return <td key={s.store_name} style={{ padding:"8px 12px", textAlign:"right", fontFamily:"'DM Mono',monospace", background:isMin?T.greenLight:p===undefined?"#fff5f5":"transparent", color:isMin?T.green:p===undefined?T.red:T.ink, fontWeight:isMin?700:400 }}>
                                                      {p!==undefined ? `$${p.toFixed(2)}` : <span title="Not available at this store">N/A</span>}
                                           </td>;
                                  })}
                                </tr>
                              );
                            })}
                            <tr style={{ borderTop:`2px solid ${T.border}` }}>
                              <td style={{ padding:"10px 12px", fontWeight:700, fontFamily:"'Playfair Display',serif" }}>🛒 Total Basket</td>
                              {(() => {
                                const minTotal = Math.min(...stores.map(st => pm.totals[st.store_name] || Infinity));
                                return stores.map(s => {
                                  const total = pm.totals[s.store_name] || 0;
                                  const isMin = Math.abs(total - minTotal) < 0.001;
                                  return (
                                    <td key={s.store_name} style={{ padding:"10px 12px", textAlign:"right", fontFamily:"'DM Mono',monospace", fontWeight:700, background:isMin?T.greenLight:"transparent", color:isMin?T.green:T.ink }}>
                                      ${total.toFixed(2)}{isMin && <span style={{ fontSize:10, marginLeft:4, letterSpacing:"0.04em" }}>✓ CHEAPEST</span>}
                                    </td>
                                  );
                                });
                              })()}
                            </tr>
                          </tbody>
                        </table>
                        <p style={{ fontSize:11, color:T.inkSec, marginTop:8, fontStyle:"italic" }}>
                            * <span style={{ color:T.red }}>N/A</span> = item not carried at this store and excluded from that store's total.
                        </p>
                      </div>
                    </Card>
                  </>
                )}
              </div>
            )}

            {activeTab==="route" && (
              <Card className="fu1">
                <SectionHead label="Optimized Shopping Route" sub="Nearest-neighbor route optimization" delay="1" />
                {!route.length ? <p style={{ color:T.inkSec }}>No route available.</p> : (
                  <>
                    <div style={{ marginBottom:"1.5rem" }}>
                      {[{ stop:0, store_name:`📍 ${loc.city||"Your Location"}`, isStart:true }, ...route].map((stop,i) => (
                        <div key={i} style={{ display:"flex", gap:16, alignItems:"flex-start" }}>
                          <div style={{ display:"flex", flexDirection:"column", alignItems:"center" }}>
                            <div style={{ width:32, height:32, borderRadius:"50%", background:stop.isStart?T.greenLight:T.surfaceAlt, border:`2px solid ${stop.isStart?T.green:T.border}`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:12, fontFamily:"'DM Mono',monospace", color:stop.isStart?T.green:T.inkSec, flexShrink:0 }}>
                              {stop.isStart?"★":stop.stop}
                            </div>
                            {i<route.length && <div style={{ width:2, height:28, background:T.border }} />}
                          </div>
                          <div style={{ paddingBottom:12, paddingTop:5 }}>
                            <div style={{ fontSize:15, fontWeight:600, fontFamily:"'Playfair Display',serif", color:stop.isStart?T.green:T.ink }}>{stop.store_name}</div>
                            {!stop.isStart && <div style={{ fontSize:12, color:T.inkSec, marginTop:2 }}>{stop.distance_km} km away</div>}
                          </div>
                        </div>
                      ))}
                    </div>
                    {loc.lat && route.length>0 && (
                      <a href={`https://www.google.com/maps/dir/${loc.lat},${loc.lng}/${route.map(s=>`${s.lat},${s.lng}`).join("/")}`} target="_blank" rel="noopener noreferrer"
                        style={{ display:"inline-block", padding:"10px 20px", background:T.ink, color:"#FFF", borderRadius:4, fontSize:12, fontWeight:700, letterSpacing:"0.04em", textTransform:"uppercase", textDecoration:"none", fontFamily:"'Lato',sans-serif" }}>
                        Open in Google Maps ↗
                      </a>
                    )}
                  </>
                )}
              </Card>
            )}

            {activeTab==="nutrition" && (
              <div className="fu1" style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"1.25rem" }}>
                <Card>
                  <SectionHead label="Nutrition Report" delay="1" />
                  <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:8, marginBottom:"1.25rem" }}>
                    {[
                      { label:"Calories",  value: scores.calories  ?? 0, unit:"kcal", color:T.amber },
                      { label:"Protein",   value: scores.protein_g ?? 0, unit:"g",    color:T.green },
                      { label:"Carbs",     value: scores.carbs_g   ?? 0, unit:"g",    color:T.blue  },
                      { label:"Fat",       value: scores.fat_g     ?? 0, unit:"g",    color:T.red   },
                      { label:"Fiber",     value: scores.fiber_g   ?? 0, unit:"g",    color:T.greenMid },
                    ].map(m => (
                      <div key={m.label} style={{ padding:"10px 8px", background:T.surfaceAlt, borderRadius:6, textAlign:"center", border:`1px solid ${T.border}` }}>
                        <div style={{ fontFamily:"'DM Mono',monospace", fontSize:18, fontWeight:500, color:m.color }}>{m.value}</div>
                        <div style={{ fontSize:10, color:T.inkSec, fontWeight:700, letterSpacing:"0.04em", textTransform:"uppercase" }}>{m.unit}</div>
                        <div style={{ fontSize:11, color:T.inkSec, marginTop:2 }}>{m.label}</div>
                      </div>
                    ))}
                  </div>
                  <ScoreBar label="Protein Score"    value={scores.protein_score   ??0} color={T.green} />
                  <ScoreBar label="Vegetable Score"  value={scores.vegetable_score ??0} color={T.greenMid} />
                  <ScoreBar label="Carb Score"       value={scores.carb_score      ??0} color={T.amber} />
                  <ScoreBar label="Fat Score"        value={scores.fat_score       ??0} color={T.blue} />
                  <div style={{ marginTop:"1rem", padding:"12px 16px", background:T.surfaceAlt, borderRadius:6, textAlign:"center" }}>
                    <div style={{ fontSize:11, fontWeight:700, color:T.inkSec, letterSpacing:"0.06em", textTransform:"uppercase", marginBottom:4 }}>Health Rating</div>
                    <div style={{ fontFamily:"'Playfair Display',serif", fontSize:20, color:T.green }}>{scores.health_rating||"—"}</div>
                  </div>
                </Card>
                <Card>
                  <SectionHead label="AI Feedback" delay="2" />
                  {feedback.summary && <p style={{ fontSize:13, color:T.inkSec, lineHeight:1.7, marginBottom:"1rem" }}>{feedback.summary}</p>}
                  {feedback.strengths?.length>0 && (
                    <div style={{ marginBottom:"1rem" }}>
                      <div style={{ fontSize:11, fontWeight:700, color:T.green, letterSpacing:"0.06em", textTransform:"uppercase", marginBottom:6 }}>Strengths</div>
                      {feedback.strengths.map((s,i) => <div key={i} style={{ fontSize:13, padding:"5px 0", borderBottom:`1px solid ${T.border}`, display:"flex", gap:8 }}><span style={{ color:T.green }}>+</span>{s}</div>)}
                    </div>
                  )}
                  {feedback.weaknesses?.length>0 && (
                    <div style={{ marginBottom:"1rem" }}>
                      <div style={{ fontSize:11, fontWeight:700, color:T.red, letterSpacing:"0.06em", textTransform:"uppercase", marginBottom:6 }}>Weaknesses</div>
                      {feedback.weaknesses.map((w,i) => <div key={i} style={{ fontSize:13, padding:"5px 0", borderBottom:`1px solid ${T.border}`, display:"flex", gap:8 }}><span style={{ color:T.red }}>−</span>{w}</div>)}
                    </div>
                  )}
                  {feedback.recommendations?.length>0 && (
                    <div>
                      <div style={{ fontSize:11, fontWeight:700, color:T.blue, letterSpacing:"0.06em", textTransform:"uppercase", marginBottom:6 }}>Recommendations</div>
                      {feedback.recommendations.map((r,i) => <div key={i} style={{ fontSize:13, padding:"5px 0", borderBottom:`1px solid ${T.border}`, display:"flex", gap:8 }}><span style={{ color:T.blue }}>→</span>{r}</div>)}
                    </div>
                  )}
                </Card>
              </div>
            )}

            {activeTab==="subs" && (
              <Card className="fu1">
                <SectionHead label="Smart Substitutions" sub="Choose your preferred alternative, then regenerate" delay="1" />
                {!Object.keys(subs).length ? <p style={{ color:T.inkSec }}>No substitutions generated.</p> : (
                  <>
                    <div style={{ display:"flex", flexDirection:"column", gap:16, marginBottom:"1.5rem" }}>
                      {Object.entries(subs).map(([item, options]) => (
                        <div key={item} style={{ padding:"1rem 1.25rem", borderRadius:6, background:T.surfaceAlt, border:`1px solid ${T.border}` }}>
                          <div style={{ fontFamily:"'Playfair Display',serif", fontWeight:600, textTransform:"capitalize", marginBottom:10 }}>{item}</div>
                          <div style={{ display:"flex", gap:8, flexWrap:"wrap" }}>
                            {["Keep original", ...(Array.isArray(options)?options:[])].map(opt => (
                              <button key={opt} onClick={()=>setSelectedSubs(p=>({...p,[item]:opt}))}
                                style={{ fontSize:12, padding:"5px 12px", borderRadius:20, border:`1px solid ${selectedSubs[item]===opt||(!selectedSubs[item]&&opt==="Keep original")?T.green:T.border}`, background:selectedSubs[item]===opt||(!selectedSubs[item]&&opt==="Keep original")?T.greenLight:"transparent", color:selectedSubs[item]===opt||(!selectedSubs[item]&&opt==="Keep original")?T.green:T.inkSec, cursor:"pointer", fontFamily:"'Lato',sans-serif", fontWeight:700, textTransform:"capitalize", transition:"all 0.15s" }}>
                                {opt==="Keep original"?"✓ Keep original":`↳ ${opt}`}
                              </button>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                    <div style={{ borderTop:`1px solid ${T.border}`, paddingTop:"1.25rem" }}>
                      {activeSubCount > 0 && (
                        <div style={{ marginBottom:10, fontSize:13, color:T.green, fontWeight:600 }}>
                          ✓ {activeSubCount} substitution{activeSubCount>1?"s":""} selected
                        </div>
                      )}
                      <button onClick={handleRegenerate} disabled={regenLoading}
                        style={{ padding:"12px 28px", background: activeSubCount>0 ? T.green : T.borderDark, color:"#FFF", border:"none", borderRadius:4, fontSize:13, fontWeight:700, letterSpacing:"0.04em", textTransform:"uppercase", cursor: activeSubCount>0 ? "pointer" : "not-allowed", fontFamily:"'Lato',sans-serif", transition:"background 0.15s", opacity: regenLoading ? 0.7 : 1 }}>
                        {regenLoading ? "Regenerating…" : "↺ Regenerate Plan with Substitutions"}
                      </button>
                      <p style={{ fontSize:12, color:T.inkSec, marginTop:8 }}>
                        {activeSubCount === 0 ? "Select at least one substitution above to regenerate" : "This will rebuild your shopping list, stores, route and budget with the new items"}
                      </p>
                      {regenMsg && (
                        <div style={{ marginTop:10, padding:"10px 14px", borderRadius:6, fontSize:13, fontWeight:500, background: regenMsg.startsWith("✓") ? T.greenLight : T.redLight, color: regenMsg.startsWith("✓") ? T.green : T.red, border: `1px solid ${regenMsg.startsWith("✓") ? T.green+"33" : T.red+"33"}` }}>
                          {regenMsg}
                        </div>
                      )}
                    </div>
                  </>
                )}
              </Card>
            )}

            {activeTab==="budget" && (
              <Card className="fu1">
                <SectionHead label="Budget Optimization" delay="1" />
                {(pmExpensiveStore || pmCheapestStore) && (
                  <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8, marginBottom:"1.25rem", padding:"10px 14px", background:T.surfaceAlt, borderRadius:6, border:`1px solid ${T.border}`, fontSize:12 }}>
                    <div><span style={{ color:T.inkSec }}>Most expensive store: </span><span style={{ fontWeight:700, color:T.red }}>{pmExpensiveStore || "—"}</span></div>
                    <div><span style={{ color:T.inkSec }}>Cheapest single store: </span><span style={{ fontWeight:700, color:T.green }}>{pmCheapestStore || "—"}</span></div>
                  </div>
                )}
                <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:12, marginBottom:"1.25rem" }}>
                  {[
                    { label:"Without Optimization", sublabel: pmExpensiveStore ? `Single store: ${pmExpensiveStore}` : "Most expensive store", value:`$${pmOriginalCost}`,  color:T.red   },
                    { label:"With Optimization",    sublabel:"Multi-store cheapest basket",                                                           value:`$${pmOptimizedCost}`, color:T.green },
                    { label:"You Save",             sublabel:"vs worst single store",                                                                  value:`$${pmMoneySaved}`,    color:T.blue  },
                  ].map((m,i) => (
                    <div key={i} style={{ padding:"1.25rem", borderRadius:6, textAlign:"center", background:T.surfaceAlt, border:`1px solid ${T.border}` }}>
                      <div style={{ fontFamily:"'DM Mono',monospace", fontSize:26, fontWeight:500, color:m.color }}>{m.value}</div>
                      <div style={{ fontSize:11, color:T.ink, fontWeight:700, letterSpacing:"0.04em", textTransform:"uppercase", marginTop:4 }}>{m.label}</div>
                      <div style={{ fontSize:11, color:T.inkSec, marginTop:2 }}>{m.sublabel}</div>
                    </div>
                  ))}
                </div>
                {budgetOpt.substitutions?.length>0 && (
                  <div>
                    <div style={{ fontSize:11, fontWeight:700, color:T.inkSec, letterSpacing:"0.06em", textTransform:"uppercase", marginBottom:10 }}>Budget Swaps Applied</div>
                    {budgetOpt.substitutions.map((s,i) => (
                      <div key={i} style={{ display:"flex", alignItems:"center", gap:10, padding:"8px 0", borderBottom:`1px solid ${T.border}`, fontSize:13 }}>
                        <span style={{ color:T.red, flex:1, textTransform:"capitalize" }}>{s.original}</span>
                        <span style={{ color:T.inkTer }}>→</span>
                        <span style={{ color:T.green, flex:1, textTransform:"capitalize" }}>{s.replacement}</span>
                      </div>
                    ))}
                  </div>
                )}
              </Card>
            )}

          </div>
        )}
        </div>
      </div>

      {/* Floating chat button — shown when panel is closed */}
      {!chatOpen && (
        <button onClick={() => setChatOpen(true)} style={{
          position: "fixed", bottom: 28, right: 28, zIndex: 999,
          width: 60, height: 60, borderRadius: "50%",
          background: T.green, border: "none", color: "#FFF",
          fontSize: 24, cursor: "pointer", boxShadow: "0 4px 20px rgba(45,106,79,0.4)",
          display: "flex", alignItems: "center", justifyContent: "center",
          transition: "transform 0.15s, box-shadow 0.15s",
        }}
          onMouseEnter={e => { e.currentTarget.style.transform = "scale(1.1)"; e.currentTarget.style.boxShadow = "0 6px 28px rgba(45,106,79,0.5)"; }}
          onMouseLeave={e => { e.currentTarget.style.transform = "scale(1)"; e.currentTarget.style.boxShadow = "0 4px 20px rgba(45,106,79,0.4)"; }}
        >
          🤖
        </button>
      )}

      {/* Chat panel */}
      {chatOpen && <ChatPanel onClose={() => setChatOpen(false)} />}
    </>
  );
}
