"use client";
import { useEffect, useState } from "react";
import Link from "next/link";

const L = [
  ["premier-league", "Premier League"],
  ["la-liga", "La Liga"],
  ["serie-a", "Serie A"],
  ["bundesliga", "Bundesliga"],
  ["ligue-1", "Ligue 1"],
] as const;

type Variant = { label: string; scenario: string[] };
type ExperimentResult = { id?: string | null; seed?: string; table?: Array<{ label: string; home: number; draw: number; away: number; vsFirstPp: { home: number; draw: number; away: number } }>; body?: { note?: string }; count?: number };

export function ExperimentLab({ replayId }: { replayId?: string }) {
  const [name, setName] = useState("Untitled experiment");
  const [dataset, setDataset] = useState("current-league-history");
  const [model, setModel] = useState("goalgrid-ensemble");
  const [league, setLeague] = useState("premier-league");
  const [teams, setTeams] = useState<string[]>([]);
  const [home, setHome] = useState("");
  const [away, setAway] = useState("");
  const [runs, setRuns] = useState(100);
  const [seed, setSeed] = useState("");
  const [result, setResult] = useState<ExperimentResult | null>(null);
  const [msg, setMsg] = useState("");
  const [running, setBusy] = useState(false);
  const [replayed, setReplayed] = useState<string | null>(null);
  const busy = running || (Boolean(replayId) && replayed !== replayId);
  const variants: Variant[] = [
    { label: "Baseline", scenario: [] },
    { label: "Heavy rain", scenario: ["heavy-rain"] },
  ];

  useEffect(() => {
    let off = false;
    fetch(`/api/simulation/teams?league=${league}`)
      .then(r => r.json())
      .then(j => {
        if (off) return;
        const t = j.teams || [];
        setTeams(t);
        setHome(t[0] || "");
        setAway(t[1] || "");
      })
      .catch(() => !off && setMsg("Teams unavailable."));
    return () => { off = true; };
  }, [league]);

  useEffect(() => {
    if (!replayId) return;
    fetch(`/api/simulation/runs/${replayId}`)
      .then(r => r.json())
      .then(j => {
        if (!j.run) { setMsg(j.error || "Experiment not found."); return; }
        const run = j.run;
        setName(String(run.configuration?.name || "Saved experiment"));
        setLeague(String(run.league_slug || "premier-league"));
        setHome(String(run.configuration?.home || ""));
        setAway(String(run.configuration?.away || ""));
        setRuns(Number(run.configuration?.runs || 100));
        setSeed(String(run.seed || ""));
        setModel(String(run.configuration?.model || "goalgrid-ensemble"));
        setResult({ id: run.id, seed: run.seed, table: run.result?.table, count: run.record_count, body: { note: "Loaded from the immutable stored experiment run." } });
      })
      .catch(() => setMsg("Could not load the experiment."))
      .finally(() => setReplayed(replayId));
  }, [replayId]);

  async function run() {
    setBusy(true); setMsg("");
    const r = await fetch("/api/simulation/experiment", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, dataset, model, league, home, away, runs, seed: seed || undefined, variants }),
    });
    const j = await r.json().catch(() => ({}));
    if (r.ok) {
      setResult(j);
      if (j.seed) setSeed(j.seed);
      if (j.id) history.replaceState(null, "", `/simulation/experiments?replay=${j.id}`);
    } else setMsg(j.error || "Experiment failed.");
    setBusy(false);
  }

  return <>
    <div className="row">
      <div>
        <h1>Experiment Lab</h1>
        <p className="sub">Create reproducible research runs, keep the seed, compare assumptions, and reopen the stored result later.</p>
      </div>
      <Link className="btn sm" href="/simulation/compare">Model comparison</Link>
    </div>

    <div className="card" style={{ display: "grid", gap: 12 }}>
      <div className="grid">
        <label>Experiment name<input className="in" value={name} onChange={e => setName(e.target.value)} maxLength={80} /></label>
        <label>Dataset<select value={dataset} onChange={e => setDataset(e.target.value)}><option value="current-league-history">Current league history</option></select></label>
        <label>Model<select value={model} onChange={e => setModel(e.target.value)}><option value="goalgrid-ensemble">GoalGrid weighted ensemble</option><option value="poisson-strength">Poisson strength baseline</option></select></label>
        <label>League<select value={league} onChange={e => setLeague(e.target.value)}>{L.map(([k, n]) => <option key={k} value={k}>{n}</option>)}</select></label>
        <label>Home<select value={home} onChange={e => setHome(e.target.value)}>{teams.map(t => <option key={t} value={t}>{t}</option>)}</select></label>
        <label>Away<select value={away} onChange={e => setAway(e.target.value)}>{teams.map(t => <option key={t} value={t}>{t}</option>)}</select></label>
        <label>Runs<select value={runs} onChange={e => setRuns(Number(e.target.value))}>{[100, 1000].map(n => <option key={n} value={n}>{n.toLocaleString()}</option>)}</select></label>
        <label>Seed (optional)<input className="in" value={seed} onChange={e => setSeed(e.target.value.replace(/[^A-Za-z0-9]/g, "").slice(0, 16))} placeholder="reproducible seed" /></label>
      </div>
      <div className="chips">{variants.map(v => <span className="chip" key={v.label}>{v.label}</span>)}</div>
      <button className="btn p" onClick={() => void run()} disabled={busy || !home || !away || home === away || !name.trim()}>{busy ? "Running…" : "Run experiment"}</button>
      {msg && <div className="err">{msg}</div>}
    </div>

    {result?.table && <>
      <div className="card scroll">
        <table><thead><tr><th>VARIANT</th><th>HOME</th><th>DRAW</th><th>AWAY</th><th>Δ HOME</th><th>Δ DRAW</th><th>Δ AWAY</th></tr></thead>
          <tbody>{result.table.map(x => <tr key={x.label}><td>{x.label}</td><td>{(x.home * 100).toFixed(2)}%</td><td>{(x.draw * 100).toFixed(2)}%</td><td>{(x.away * 100).toFixed(2)}%</td><td>{x.vsFirstPp.home.toFixed(1)} pp</td><td>{x.vsFirstPp.draw.toFixed(1)} pp</td><td>{x.vsFirstPp.away.toFixed(1)} pp</td></tr>)}</tbody>
        </table>
      </div>
      <div className="card">
        <div className="meta"><span>Run ID {result.id || replayId || "—"}</span><span>Seed {result.seed || seed || "—"}</span><span>Dataset {dataset}</span><span>Model {model}</span></div>
        <div className="chips" style={{ marginTop: 10 }}>
          {(result.id || replayId) && <><a className="chip" href={`/api/simulation/runs/${result.id || replayId}/export?format=csv`}>Export CSV</a><a className="chip" href={`/api/simulation/runs/${result.id || replayId}/export?format=json`}>Export JSON</a></>}
          {result.id && <Link className="chip" href={`/simulation/experiments?replay=${result.id}`}>Permalink</Link>}
        </div>
        <p className="note">{result.body?.note || "Every variant uses the same seed; differences can still include sampling error when run counts are small."}</p>
      </div>
    </>}
  </>;
}
