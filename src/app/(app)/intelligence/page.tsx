import Link from "next/link";
import { Gate } from "@/components/Gate";
import { PageHero } from "@/components/PageHero";
import { AskLab, NotesBox, VerifyBox } from "@/components/LabTools";
import { SaveRunButton } from "@/components/SaveRunButton";
import { getViewer } from "@/lib/app/session";
import { hasTier } from "@/lib/entitlements";
import { RANGES, isDelayed, listGames, loadSeries, type Range } from "@/lib/lab/data";
import { analyse, INSUFFICIENT } from "@/lib/lab/stats";
import { LuxuryReveal } from "@/components/LuxuryReveal";
export const dynamic = "force-dynamic";
type Sp = { game?: string; source?: string; range?: string; window?: string; threshold?: string };
const num = (x: unknown, d = 2) => (typeof x === "number" ? x.toFixed(d) : "n/a"), p3 = (x: number) => (x < 0.001 ? "< 0.001" : x.toFixed(3));
const Short = () => <p className="note">{INSUFFICIENT}</p>;
function Spark({ pts }: { pts: { mean: number }[] }) {
  if (pts.length < 2) return null; const lo = Math.min(...pts.map(p => p.mean)), hi = Math.max(...pts.map(p => p.mean)), W = 600, H = 80, y = (v: number) => H - 6 - ((v - lo) / (hi - lo || 1)) * (H - 12);
  return <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Rolling mean over time" style={{ width: "100%", height: 80 }}><polyline fill="none" stroke="currentColor" strokeWidth="2" points={pts.map((p, i) => `${(i / (pts.length - 1)) * W},${y(p.mean)}`).join(" ")} /></svg>;
}
export default async function Intelligence({ searchParams }: { searchParams: Promise<Sp> }) {
  const v = await getViewer();
  if (!hasTier(v.tier, "premium")) return <Gate need="premium" signedIn={v.signedIn} title="Game Intelligence Lab" blurb="Explore the data behind live game outcomes: distributions, streaks, randomness tests and change monitoring, all from stored observations." />;
  const sp = await searchParams; let games: Awaited<ReturnType<typeof listGames>> = [], failed = false;
  try { games = await listGames(); } catch { failed = true; }
  const head = <PageHero image="lounge" badge="PREMIUM" title="Game Intelligence Lab" subtitle="Statistical research on observed game data. Historical analysis of stored observations, not predictions." position="50% 62%" />;
  if (failed) return <>{head}<div className="err">The Lab is temporarily unavailable.</div></>;
  if (!games.length) return <>{head}<div className="card"><b>No data available</b><p className="note">No game has stored observations yet. Once a source you are licensed to use is connected, games and sources appear here. Nothing on this page is ever filled in with sample numbers.</p></div></>;
  const game = games.find(g => g.id === sp.game) ?? games[0], source = game.sources.find(s => s.id === sp.source) ?? game.sources[0], range = (Object.keys(RANGES).includes(sp.range ?? "") ? sp.range : "24H") as Range;
  const window = Math.min(200, Math.max(5, Number(sp.window) || 20)), threshold = Math.min(1000, Math.max(0, Number(sp.threshold) || 2));
  let s: Awaited<ReturnType<typeof loadSeries>> | null = null; try { s = await loadSeries(game.id, source.id, range); } catch { /* shown below */ }
  const selector = <LuxuryReveal className="lux-card"><form className="card" method="get" style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "end" }}>
    <label>Game<select name="game" defaultValue={game.id}>{games.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}</select></label>
    <label>Source<select name="source" defaultValue={source.id}>{game.sources.map(x => <option key={x.id} value={x.id}>{x.name}</option>)}</select></label>
    <label>Time range<select name="range" defaultValue={range}>{Object.keys(RANGES).map(r => <option key={r}>{r}</option>)}</select></label>
    <label>Window<input name="window" type="number" min={5} max={200} defaultValue={window} /></label><label>Threshold<input name="threshold" type="number" step="0.1" defaultValue={threshold} /></label>
    <button className="btn p" type="submit">Analyse</button></form></LuxuryReveal>;
  if (!s) return <>{head}{selector}<div className="err">Could not read observations right now.</div></>;
  if (!s.values.length) return <>{head}{selector}<div className="card"><b>No data available</b><p className="note">There are no stored observations for this game, source and time range.</p></div></>;
  const a = analyse(s.values, { window, threshold, times: s.times }), sm = a.summary, delayed = isDelayed(s.lastObservedAt);
  return (<>{head}{selector}
    {delayed && <div className="err">Data is currently delayed. The newest observation is from {s.lastObservedAt ? new Date(s.lastObservedAt).toUTCString() : "an unknown time"}.</div>}
    <div className="chips" style={{ alignItems: "center", marginTop: 12 }}><SaveRunButton game={game.id} source={source.id} range={range} window={window} threshold={threshold} /><a className="chip" href={`/api/lab/export?game=${game.id}&source=${source.id}&range=${range}&format=csv`}>Export CSV</a><a className="chip" href={`/api/lab/export?game=${game.id}&source=${source.id}&range=${range}&window=${window}&threshold=${threshold}&format=json`}>Export analysis (JSON)</a><Link className="chip" href="/intelligence/compare">Compare</Link><Link className="chip" href="/intelligence/runs">Saved runs</Link></div>
    {sm.status === "ok" && (
      <LuxuryReveal className="lux-card">
        <div className="grid">
          {([["Observations", String(sm.count)], ["Mean", num(sm.mean)], ["Median", num(sm.median)], ["Std deviation", num(sm.sd)], ["P95", num(sm.p95)], ["P99", num(sm.p99)], ["Minimum", num(sm.min)], ["Maximum", num(sm.max)]] as const).map(([k, val]) => (
            <div className="card" key={k}>
              <span className="note">{k}</span>
              <b style={{ display: "block", fontSize: 22 }}>{val}</b>
            </div>
          ))}
        </div>
      </LuxuryReveal>
    )}
    {s.partial > 0 && <p className="note">{s.partial} of {s.values.length} observations are marked partial.</p>}
    <h2>Distribution</h2>{a.distribution.status === "ok" ? <div className="card">{a.distribution.buckets.map(b => <div key={b.label} style={{ display: "flex", gap: 10, alignItems: "center", margin: "4px 0" }}><span style={{ width: 90 }}>{b.label}</span><div style={{ flex: 1, background: "rgba(127,127,127,.2)", height: 10, borderRadius: 5 }}><div style={{ width: `${b.share * 100}%`, height: 10, borderRadius: 5, background: "currentColor" }} /></div><span className="n" style={{ width: 120, textAlign: "right" }}>{b.count} ({(b.share * 100).toFixed(1)}%)</span></div>)}<p className="note">Normalised entropy {a.distribution.entropy.toFixed(3)}. Bucket edges are a display choice, not a claim about the game.</p></div> : <Short />}
    <h2>Streaks below {threshold}</h2>{a.streaks.status === "ok" ? <div className="card"><div className="meta"><span>Share below: {(a.streaks.shareBelow * 100).toFixed(1)}%</span><span>Longest run: {a.streaks.longest}</span><span>Current: {a.streaks.current.length} {a.streaks.current.type === "below" ? "below" : "since last run below"}</span><span>Runs: {a.streaks.runCount}</span></div>
      <table><thead><tr><th>RUN LENGTH</th><th>RUNS</th></tr></thead><tbody>{a.streaks.histogram.map(h => <tr key={h.length}><td>{h.length}</td><td className="n">{h.runs}</td></tr>)}</tbody></table>
      <p className="note">If every observation were independent, the longest run would typically be around {num(a.streaks.expectedLongestIfIndependent, 1)}. A long run is a record of what happened. It says nothing about what comes next.</p></div> : <Short />}
    <h2>Rolling statistics (window {window})</h2>{a.rolling.status === "ok" ? <div className="card"><Spark pts={a.rolling.points} /><div className="meta"><span>Latest spread: {num(a.rolling.latestSd)}</span><span>Overall spread: {num(a.rolling.overallSd)}</span><span>Ratio: {num(a.rolling.latestVsOverall)}</span></div></div> : <Short />}
    <h2>Randomness checks</h2><div className="card scroll"><table><thead><tr><th>TEST</th><th>RESULT</th><th>READING</th></tr></thead><tbody>
      <tr><td>Runs test</td>{a.randomness.runs.status === "ok" ? <><td className="n">z {num(a.randomness.runs.z)}, p {p3(a.randomness.runs.p)}</td><td>{a.randomness.runs.p < 0.01 ? "Clustering or alternation beyond chance" : "No clear departure from random order"}</td></> : <td colSpan={2}>{INSUFFICIENT}</td>}</tr>
      <tr><td>Drift (first half vs second half)</td>{a.randomness.drift.status === "ok" ? <><td className="n">D {num(a.randomness.drift.d, 3)}, p {p3(a.randomness.drift.p)}</td><td>{a.randomness.drift.p < 0.01 ? "The distribution looks different between halves" : "No clear distribution shift"}</td></> : <td colSpan={2}>{INSUFFICIENT}</td>}</tr>
      <tr><td>Autocorrelation (lags 1 to 10)</td>{a.randomness.autocorrelation.status === "ok" ? <><td className="n">{a.randomness.autocorrelation.outside} outside ±{num(a.randomness.autocorrelation.band, 3)}</td><td>About {num(a.randomness.autocorrelation.expectedOutsideByChance, 1)} expected by chance alone</td></> : <td colSpan={2}>{INSUFFICIENT}</td>}</tr>
      <tr><td>Next after low vs after high</td>{a.dependency.status === "ok" ? <><td className="n">{(a.dependency.afterBelow.shareAtOrAbove * 100).toFixed(1)}% vs {(a.dependency.afterAtOrAbove.shareAtOrAbove * 100).toFixed(1)}% at or above {threshold}, p {p3(a.dependency.p)}</td><td>{a.dependency.p < 0.01 ? "An observed relationship in this sample" : "No clear relationship"}</td></> : <td colSpan={2}>{INSUFFICIENT}</td>}</tr>
    </tbody></table><p className="note">Several tests are run at once, so an occasional small p is expected. A result describes this sample only and does not mean future outcomes can be forecast.</p></div>
    <h2>Unusual observations</h2>{a.anomalies.status === "ok" ? <div className="card scroll">{"flagged" in a.anomalies && a.anomalies.flagged.length ? <table><thead><tr><th>#</th><th>VALUE</th><th>ROBUST Z</th><th>WHEN</th></tr></thead><tbody>{a.anomalies.flagged.map(f => <tr key={f.index}><td className="n">{f.index + 1}</td><td className="n">{num(f.value)}</td><td className="n">{num(f.z)}</td><td>{f.at ? new Date(f.at).toUTCString() : "n/a"}</td></tr>)}</tbody></table> : <p className="note">No observations were flagged.</p>}<p className="note">{a.anomalies.note}</p></div> : <Short />}
    <h2>Change monitor</h2>{a.changePoint.status === "ok" ? <div className="card"><div className="meta"><span>Evidence: {a.changePoint.evidence}</span><span>Largest shift near observation {a.changePoint.index}</span><span>Mean before {num(a.changePoint.before)}, after {num(a.changePoint.after)}</span></div><p className="note">Every split point is scanned, so the bar for “possible” and “strong” is deliberately high. This is a statistical flag, not a claim that anything was changed.</p></div> : <Short />}
    <h2>Ask the Lab</h2><AskLab game={game.id} source={source.id} range={range} window={window} threshold={threshold} />
    <h2>Research notes</h2><NotesBox game={game.id} range={range} />
    <h2>Verification</h2><VerifyBox source={source.id} />
    <p className="note">Game Intelligence is historical analysis for research. It does not predict results and is not betting advice. 18+. Play responsibly.</p></>);
}
