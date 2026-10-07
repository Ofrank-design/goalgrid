"use client";
import { useState } from "react";
const OPTS: [string, string][] = [["home", "Home win"], ["draw", "Draw"], ["away", "Away win"]];
export function PickForm({ matchId, date, existing, open }: { matchId: string; date: string; existing: { pick: string; confidence: number } | null; open: boolean }) {
  const [pick, setPick] = useState(existing?.pick ?? ""); const [conf, setConf] = useState(existing?.confidence ?? 60); const [msg, setMsg] = useState<{ ok: boolean; t: string } | null>(null); const [busy, setBusy] = useState(false);
  async function save() { setBusy(true); setMsg(null); try { const r = await fetch("/api/predict/pick", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ matchId, date, pick, confidence: conf }) }), j = await r.json().catch(() => ({})); setMsg(r.ok ? { ok: true, t: "Pick saved. You can change it until kickoff." } : { ok: false, t: j.error ?? "Could not save." }); } catch { setMsg({ ok: false, t: "Network error." }); } finally { setBusy(false); } }
  if (!open) return <p className="note">Picks are closed for this match.{existing ? ` Your pick: ${existing.pick} at ${existing.confidence}%.` : ""}</p>;
  return (<div style={{ display: "grid", gap: 12 }}>
    <div className="tabs" style={{ margin: 0 }}>{OPTS.map(([k, l]) => <button key={k} type="button" className={`tab ${pick === k ? "on" : ""}`} onClick={() => setPick(k)} style={{ background: "none", cursor: "pointer" }}>{l}</button>)}</div>
    <label className="note">How sure are you? <b style={{ color: "#fbfafc" }}>{conf}%</b><input type="range" min={40} max={95} value={conf} onChange={e => setConf(Number(e.target.value))} style={{ width: "100%" }} aria-label="Confidence" /></label>
    <p className="note">Points reward calibration: a confident right call scores well, a confident wrong call costs more than a cautious one.</p>
    <button className="btn p sm" type="button" disabled={busy || !pick} onClick={() => void save()} style={{ justifySelf: "start" }}>{existing ? "Update pick" : "Lock in pick"}</button>
    {msg && <div className="msg" role="status" style={{ color: msg.ok ? "#00e676" : "#ff5d5d" }}>{msg.t}</div>}</div>);
}
