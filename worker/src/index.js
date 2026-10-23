/**
 * RochesterCRE AI analyst: a Cloudflare Worker that proxies questions to the
 * Gemini API. The API key lives only in this worker's secrets (GEMINI_API_KEY);
 * the public site never sees it.
 *
 * Abuse controls: requests are accepted only from ALLOWED_ORIGINS, questions are
 * length-capped, conversation history is trimmed, a per-IP rate limit applies, and
 * the system prompt restricts the model to the platform's own data.
 */

const DEFAULTS = {
  MODEL: "gemini-3.8-flash",
  DATA_URL: "https://gbv229.github.io/rochester-cre/data/analyst-context.json",
  ALLOWED_ORIGINS: "https://gbv229.github.io,http://localhost:3000",
};
const MAX_QUESTION = 1200;
const MAX_TURNS = 10;
const RATE = { limit: 20, windowMs: 10 * 60 * 1000 };

let cache = { at: 0, ctx: null };
const hits = new Map();

export default {
  async fetch(request, env) {
    const cfg = { ...DEFAULTS, ...env };
    const origin = request.headers.get("Origin") || "";
    const allowed = cfg.ALLOWED_ORIGINS.split(",").map((s) => s.trim());
    const cors = {
      "Access-Control-Allow-Origin": allowed.includes(origin) ? origin : allowed[0],
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
      Vary: "Origin",
    };
    const reply = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

    if (request.method === "OPTIONS") return new Response(null, { headers: cors });
    if (request.method === "GET") return reply({ ok: true, model: cfg.MODEL });
    if (request.method !== "POST") return reply({ error: "Use POST." }, 405);
    if (!allowed.includes(origin)) return reply({ error: "This analyst only answers requests from the RochesterCRE site." }, 403);
    if (!env.GEMINI_API_KEY) return reply({ error: "The analyst isn't configured yet: GEMINI_API_KEY is missing." }, 500);

    const ip = request.headers.get("CF-Connecting-IP") || "anon";
    const now = Date.now();
    const h = (hits.get(ip) || []).filter((t) => now - t < RATE.windowMs);
    if (h.length >= RATE.limit) return reply({ error: "Too many questions in a short time. Try again in a few minutes." }, 429);
    h.push(now); hits.set(ip, h);

    let body;
    try { body = await request.json(); } catch { return reply({ error: "Send JSON: { messages: [...] }" }, 400); }
    const messages = Array.isArray(body.messages) ? body.messages.slice(-MAX_TURNS) : [];
    const q = messages[messages.length - 1];
    if (!q || q.role !== "user" || typeof q.content !== "string" || !q.content.trim()) return reply({ error: "Ask a question first." }, 400);
    if (q.content.length > MAX_QUESTION) return reply({ error: `Keep questions under ${MAX_QUESTION} characters.` }, 400);

    let ctx;
    try { ctx = await loadContext(cfg.DATA_URL); } catch { return reply({ error: "Couldn't load the property data. Try again shortly." }, 502); }

    const system = buildSystemPrompt(ctx, typeof body.propertyId === "string" ? body.propertyId : null);
    const contents = messages
      .filter((m) => typeof m.content === "string")
      .map((m) => ({ role: m.role === "assistant" ? "model" : "user", parts: [{ text: m.content.slice(0, 4000) }] }));

    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${cfg.MODEL}:generateContent`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": env.GEMINI_API_KEY },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: system }] },
        contents,
        generationConfig: { temperature: 0.3, maxOutputTokens: 1400 },
      }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const msg = data?.error?.message || `Gemini returned ${res.status}`;
      return reply({ error: res.status === 429 ? "The free AI quota is used up for now. Try again later." : msg }, res.status === 429 ? 429 : 502);
    }
    const text = (data.candidates?.[0]?.content?.parts || []).map((p) => p.text || "").join("").trim();
    return reply({ answer: text || "I couldn't produce an answer to that. Try rephrasing the question.", model: cfg.MODEL });
  },
};

async function loadContext(url) {
  if (cache.ctx && Date.now() - cache.at < 60 * 60 * 1000) return cache.ctx;
  const r = await fetch(url, { cf: { cacheTtl: 3600 } });
  if (!r.ok) throw new Error(`data ${r.status}`);
  cache = { at: Date.now(), ctx: await r.json() };
  return cache.ctx;
}

function buildSystemPrompt(ctx, propertyId) {
  const focus = propertyId ? ctx.properties.find((row) => row.startsWith(propertyId + "|")) : null;
  return `You are the RochesterCRE analyst, a commercial real estate research assistant for Rochester and Monroe County, New York.

Answer only from the data below and standard real estate finance. If the data can't answer something (rent rolls, unit counts, square footage, sale prices, tenant names), say so plainly and suggest what diligence would answer it. Never invent figures. Show your math for any calculation, use dollar figures with sensible rounding, and keep answers tight: lead with the answer, then the support. Use short paragraphs or bullets. When you name a property, include its address and municipality. Politely decline requests unrelated to real estate, this market, or this dataset.

Key definitions: marketValue is the assessor's 2025 equalized full market value (not a sale price). yoyPct is the change from the 2024 roll. improvementRatio is the building's share of value. impliedNoi = marketValue x the model's market cap rate for that property type. "Fully exempt / PILOT" usually means an IDA (COMIDA) lease with payments in lieu of taxes. Underwriting defaults: ${JSON.stringify(ctx.debtDefaults)} (LTV %, rate %, amortization years, hold years, exit cap spread in bps, selling and closing costs %).

Market assumptions by NYS property class: ${JSON.stringify(ctx.assumptionsByClass)}
CBD office override: ${JSON.stringify(ctx.cbdOffice)}
Broker market data: ${JSON.stringify(ctx.market)}
Economy (FRED): ${JSON.stringify(Object.fromEntries(Object.entries(ctx.economy).map(([k, v]) => [k, { title: v.title, units: v.units, latest: v.latest }])))}

${focus ? `The user is looking at this property right now (columns as below):\n${focus}\n` : ""}
All ${ctx.properties.length} tracked properties, pipe-delimited. Columns: ${ctx.propertyColumns}
${ctx.properties.join("\n")}`;
}
