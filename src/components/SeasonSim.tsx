"use client";
import { useState } from "react";
import { SimBanner } from "./SimLab";
const LEAGUES: [string, string][] = [["premier-league", "Premier League"], ["la-liga", "La Liga"], ["serie-a", "Serie A"], ["bundesliga", "Bundesliga"], ["ligue-1", "Ligue 1"]], nice = (s: string) => s.split("-").map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(" "), pc = (x: number) => `${(x * 100).toFixed(1)}%`;
type T = { team: string; expectedPoints: number; averagePosition: number; title: number; topFour: number; relegation: number };
export function SeasonSim({ maxSeasons }: { maxSeasons: number }) {
  const [league, setLeague] = useState("premier-league"), [n, setN] = useState(Math.min(200, maxSeasons)), [seed, setSeed] = useState(""), [res, setRes] = useState<{ teams?: T[]; seed?: string; seasons?: number; note?: string; error?: string } | null>(null), [busy, setBusy] = useState(false);
  async function go() { setBusy(true); const r = await fetch("/api/simulation/season", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ league, seasons: n, ...(seed ? { seed } : {}) }) }); setRes(await r.json().catch(() => ({ error: "Network error." }))); setBusy(false); }
  return (<div style={{ display: "grid", gap: 14 }}><SimBanner /><div className="card" style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "end" }}>
    <label>Competition<select value={league} onChange={e => setLeague(e.target.value)}>{LEAGUES.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></label>
    <label>Simulated seasons<select value={n} onChange={e => setN(Number(e.target.value))}>{[50, 200, 1000].filter(x => x <= maxSeasons).map(x => <option key={x} value={x}>{x.toLocaleString("en")}</option>)}</select></label>
    <label>Seed (optional)<input className="in" value={seed} maxLength={16} onChange={e => setSeed(e.target.value.replace(/[^A-Za-z0-9]/g, ""))} /></label><button className="btn p" type="button" disabled={busy} onClick={() => void go()}>{busy ? "Simulating..." : "Run season simulation"}</button></div>
    {res?.error && <p className="note" role="alert">{res.error}</p>}
    {res?.teams && <div className="card scroll"><table><thead><tr><th>TEAM</th><th>EXP. POINTS</th><th>AVG POSITION</th><th>TITLE</th><th>TOP 4</th><th>BOTTOM 3</th></tr></thead><tbody>{res.teams.map(t => <tr key={t.team}><td>{nice(t.team)}</td><td className="n">{t.expectedPoints}</td><td className="n">{t.averagePosition}</td><td className="n">{pc(t.title)}</td><td className="n">{pc(t.topFour)}</td><td className="n">{pc(t.relegation)}</td></tr>)}</tbody></table>
      <p className="note">{res.seasons?.toLocaleString("en")} synthetic seasons · seed {res.seed}. {res.note} Percentages are shares of simulated seasons, not forecasts of the real table.</p></div>}</div>);
}
