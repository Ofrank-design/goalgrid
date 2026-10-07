"use client";
import { useState } from "react";
const Row = ({ label, opts, value, onPick, disabled }: { label: string; opts: [string, string][]; value: string; onPick: (v: string) => void; disabled: boolean }) => (
  <div><span className="note">{label}</span><div className="tabs" style={{ margin: "4px 0 0" }}>{opts.map(([k, l]) => <button key={k} type="button" disabled={disabled} className={`tab ${value === k ? "on" : ""}`} onClick={() => onPick(k)} style={{ background: "none", cursor: "pointer" }}>{l}</button>)}</div></div>);
export function MarketPickForm({ matchId, date, existing, open }: { matchId: string; date: string; existing: Record<string, string>; open: boolean }) {
  const [v, setV] = useState({ btts: existing.btts ?? "", over25: existing.over25 ?? "", exact: existing.exact ?? "" }), [msg, setMsg] = useState<string | null>(null), [busy, setBusy] = useState(false);
  async function save(market: "btts" | "over25" | "exact") { setBusy(true); setMsg(null); const r = await fetch("/api/predict/market", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ matchId, date, market, value: v[market] }) }), j = await r.json().catch(() => ({})); setMsg(r.ok ? "Saved." : j.error ?? "Could not save."); setBusy(false); }
  if (!open) return <p className="note">Extra picks are closed. {Object.keys(existing).length ? `Yours: ${Object.entries(existing).map(([k, x]) => `${k} ${x}`).join(", ")}.` : ""}</p>;
  const exactOk = /^\d{1,2}-\d{1,2}$/.test(v.exact);
  return (<div style={{ display: "grid", gap: 10 }}><b>Extra picks (optional)</b>
    <Row label="Both teams to score · 2 points" opts={[["yes", "Yes"], ["no", "No"]]} value={v.btts} disabled={busy} onPick={x => { setV(s => ({ ...s, btts: x })); }} /><button className="btn sm" type="button" disabled={busy || !v.btts} onClick={() => void save("btts")} style={{ justifySelf: "start" }}>Save BTTS</button>
    <Row label="Over or under 2.5 goals · 2 points" opts={[["over", "Over"], ["under", "Under"]]} value={v.over25} disabled={busy} onPick={x => setV(s => ({ ...s, over25: x }))} /><button className="btn sm" type="button" disabled={busy || !v.over25} onClick={() => void save("over25")} style={{ justifySelf: "start" }}>Save over/under</button>
    <label className="note">Exact score, home-away, for example 2-1 · 8 points<input className="in" value={v.exact} maxLength={5} placeholder="2-1" onChange={e => setV(s => ({ ...s, exact: e.target.value }))} aria-label="Exact score" /></label><button className="btn sm" type="button" disabled={busy || !exactOk} onClick={() => void save("exact")} style={{ justifySelf: "start" }}>Save exact score</button>
    {msg && <div className="msg" role="status">{msg}</div>}</div>);
}
