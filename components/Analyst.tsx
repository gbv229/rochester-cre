"use client";
import { useRef, useState, useEffect, Fragment } from "react";
import { ANALYST_URL } from "../lib/config";

type Msg = { role: "user" | "assistant"; content: string };

/** Minimal, safe markdown: paragraphs, bullet and numbered lists, **bold**. No HTML is ever injected. */
function Rich({ text }: { text: string }) {
  const blocks = text.split(/\n{2,}/);
  const inline = (s: string) =>
    s.split(/(\*\*[^*]+\*\*)/g).map((part, i) =>
      part.startsWith("**") && part.endsWith("**") ? <strong key={i}>{part.slice(2, -2)}</strong> : <Fragment key={i}>{part.replace(/^#+\s*/, "")}</Fragment>);
  return (
    <>
      {blocks.map((b, i) => {
        const lines = b.split("\n").filter(Boolean);
        if (lines.length && lines.every((l) => /^\s*[-*•]\s+/.test(l)))
          return <ul key={i}>{lines.map((l, j) => <li key={j}>{inline(l.replace(/^\s*[-*•]\s+/, ""))}</li>)}</ul>;
        if (lines.length && lines.every((l) => /^\s*\d+[.)]\s+/.test(l)))
          return <ol key={i}>{lines.map((l, j) => <li key={j}>{inline(l.replace(/^\s*\d+[.)]\s+/, ""))}</li>)}</ol>;
        return <p key={i}>{lines.map((l, j) => <Fragment key={j}>{j > 0 && <br />}{inline(l)}</Fragment>)}</p>;
      })}
    </>
  );
}

export default function Analyst({ propertyId, suggestions, compact }: { propertyId?: string; suggestions: string[]; compact?: boolean }) {
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const logRef = useRef<HTMLDivElement>(null);

  useEffect(() => { logRef.current?.scrollTo({ top: logRef.current.scrollHeight }); }, [msgs, busy]);

  async function ask(question: string) {
    const q = question.trim();
    if (!q || busy) return;
    const next: Msg[] = [...msgs, { role: "user", content: q }];
    setMsgs(next); setDraft(""); setError(""); setBusy(true);
    try {
      const r = await fetch(ANALYST_URL, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ messages: next, propertyId }) });
      const data = await r.json().catch(() => ({}));
      if (!r.ok || !data.answer) throw new Error(data.error || `The analyst returned an error (${r.status}).`);
      setMsgs([...next, { role: "assistant", content: data.answer }]);
    } catch (e) {
      setError(e instanceof Error && e.message !== "Failed to fetch" ? e.message : "Couldn't reach the analyst. Check your connection and try again.");
    } finally { setBusy(false); }
  }

  if (!ANALYST_URL) {
    return (
      <div className="panel">
        <h3>AI analyst</h3>
        <p className="small muted" style={{ margin: 0 }}>The analyst is being connected. Once it's live you'll be able to ask questions about any property or the market here.</p>
      </div>
    );
  }

  return (
    <div className="panel analyst" style={{ padding: 0 }}>
      <div ref={logRef} className="analyst-log" style={{ maxHeight: compact ? 420 : "58vh" }} aria-live="polite">
        {msgs.length === 0 && (
          <div>
            <p className="small muted">Ask about the properties, the market, or the underwriting. Answers come from this platform's data, and the analyst will say when the data can't answer something.</p>
            <div className="suggest">
              {suggestions.map((s) => <button key={s} className="btn" onClick={() => ask(s)}>{s}</button>)}
            </div>
          </div>
        )}
        {msgs.map((m, i) => (
          <div key={i} className={`msg ${m.role}`}>
            <div className="who tiny">{m.role === "user" ? "You" : "Analyst"}</div>
            {m.role === "assistant" ? <Rich text={m.content} /> : <p>{m.content}</p>}
          </div>
        ))}
        {busy && <div className="msg assistant"><div className="who tiny">Analyst</div><p className="muted">Working through the data…</p></div>}
        {error && <p className="small down" role="alert">{error}</p>}
      </div>
      <form className="analyst-input" onSubmit={(e) => { e.preventDefault(); ask(draft); }}>
        <label className="sr" htmlFor={`q-${propertyId || "all"}`}>Question for the analyst</label>
        <input id={`q-${propertyId || "all"}`} value={draft} onChange={(e) => setDraft(e.target.value)} maxLength={1200}
          placeholder={propertyId ? "Ask about this property…" : "e.g. Which Henrietta apartments grew most in value?"} />
        <button className="btn primary" disabled={busy || !draft.trim()}>Ask</button>
      </form>
      <p className="tiny faint" style={{ margin: 0, padding: "0 16px 12px" }}>Powered by Google Gemini. AI answers can be wrong; check figures against the property pages.</p>
    </div>
  );
}
