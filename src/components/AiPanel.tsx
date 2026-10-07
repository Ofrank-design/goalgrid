"use client";
import { useState } from "react";
import type { AiAnalysis } from "@/types/ai";
const p = (x: number) => `${Math.round(x * 100)}%`;
export function AiPanel({ date, id }: { date: string; id: string }) {
  const [a, setA] = useState<AiAnalysis | null>(null); const [err, setErr] = useState<string | null>(null); const [busy, setBusy] = useState(false);
  async function run() {
    setBusy(true); setErr(null);
    try { const r = await fetch(`/api/analysis?date=${date}&id=${encodeURIComponent(id)}`), j = await r.json(); if (!r.ok) setErr(j.error ?? "Analysis unavailable."); else setA(j.analysis); }
    catch { setErr("Network error. Try again."); } finally { setBusy(false); }
  }
  if (!a) return <div><button className="btn p" type="button" disabled={busy} onClick={() => void run()}>{busy ? "Asking the models" : "Generate AI analysis"}</button>{err && <p className="msg" style={{ color: "#ff5d5d", marginTop: 10 }}>{err}</p>}<p className="note" style={{ marginTop: 10 }}>Language models read the same verified facts and are blended in at a small weight.</p></div>;
  return (
    <div>
      <div className="pl" style={{ marginBottom: 14 }}><div><b>{p(a.probabilities.home)}</b>Home</div><div><b>{p(a.probabilities.draw)}</b>Draw</div><div><b>{p(a.probabilities.away)}</b>Away</div></div>
      <p className="note">{a.llm.used} of {a.llm.asked} language models used. Statistical consensus: {p(a.statistical.home)} / {p(a.statistical.draw)} / {p(a.statistical.away)}.{a.llm.disagreement != null ? ` Model disagreement ${(a.llm.disagreement * 100).toFixed(1)} points.` : ""}</p>
      <h2 style={{ fontSize: 16 }}>Why</h2>
      {a.reasons.length ? <ul style={{ paddingLeft: 18, display: "grid", gap: 6 }}>{a.reasons.map((r, i) => <li key={i}>{r.text} <span className="note">({r.facts.join(", ")})</span></li>)}</ul> : <p className="note">No model gave a grounded reason.</p>}
      {a.uncertainty && <p className="note" style={{ marginTop: 10 }}>What could change it: {a.uncertainty}</p>}
      {a.perModel.length > 0 && <details><summary>Each model's answer</summary><div className="scroll"><table><thead><tr><th>MODEL</th><th>HOME</th><th>DRAW</th><th>AWAY</th><th>SCORE</th></tr></thead><tbody>{a.perModel.map(m => <tr key={m.provider}><td>{m.provider}</td><td className="n">{p(m.probabilities.home)}</td><td className="n">{p(m.probabilities.draw)}</td><td className="n">{p(m.probabilities.away)}</td><td className="n">{m.score.home}-{m.score.away}</td></tr>)}</tbody></table></div></details>}
      {a.llm.excluded.length > 0 && <details><summary>Set aside</summary><ul style={{ paddingLeft: 18 }}>{a.llm.excluded.map(e => <li key={e.provider} className="note">{e.provider}: {e.reason}</li>)}</ul></details>}
      <details><summary>Facts the models were given</summary><ul style={{ paddingLeft: 18, display: "grid", gap: 4 }}>{a.facts.map(f => <li key={f.id} className="note"><b>{f.id}</b> {f.text}</li>)}</ul></details>
    </div>
  );
}
