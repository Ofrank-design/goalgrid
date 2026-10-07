import { calibrationBins, summarize, type EvalRow } from "@/lib/ops/eval";
import { supabaseServer } from "@/lib/supabase/server";
export const dynamic = "force-dynamic";
const p1 = (x: number | null) => (x == null ? "n/a" : `${(x * 100).toFixed(1)}%`), n3 = (x: number | null) => (x == null ? "n/a" : x.toFixed(3));
export default async function Accuracy() {
  let rows: (EvalRow & { home_name: string; away_name: string; league_slug: string; kickoff_utc: string; home_goals: number; away_goals: number; outcome: string })[] = [];
  try { const { data } = await (await supabaseServer()).from("prediction_eval").select("*").order("kickoff_utc", { ascending: false }).limit(2000); rows = (data ?? []) as typeof rows; } catch { /* shown as empty */ }
  const s = summarize(rows), bins = calibrationBins(rows);
  return (<>
    <div className="row"><div><h1>How accurate is GoalGrid?</h1><p className="sub">Every prediction is stored before kickoff and scored after the final whistle. Nothing is edited afterwards. Predictions are probabilities, so we judge them on how well the numbers match reality, not just on picking winners.</p></div></div>
    {!s.n ? <div className="card"><p className="note">No predictions have been scored yet. Results appear here once matches finish.</p></div> : <>
      <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fill,minmax(180px,1fr))" }}>{[["Matches scored", String(s.n)], ["Favourite won", p1(s.accuracy)], ["Log loss", `${n3(s.logLoss)} (guessing is ${s.baselineLogLoss.toFixed(3)})`], ["Brier score", n3(s.brier)], ["Both teams score", p1(s.bttsAccuracy)], ["Over 2.5 goals", p1(s.over25Accuracy)]].map(([k, v]) => <div key={k} className="card"><div className="note">{k}</div><div style={{ fontSize: 20, fontWeight: 800, marginTop: 4 }}>{v}</div></div>)}</div>
      <h2>Calibration</h2><p className="note">When we say 60%, the favourite should win about 60% of the time. Bins with few matches are noisy.</p>
      <div className="card scroll"><table><thead><tr><th>WE SAID</th><th>MATCHES</th><th>AVERAGE SAID</th><th>HAPPENED</th></tr></thead><tbody>{bins.map(b => <tr key={b.lo}><td>{Math.round(b.lo * 100)}% to {Math.round(b.hi * 100)}%</td><td className="n">{b.n}</td><td className="n">{p1(b.predicted)}</td><td className="n">{p1(b.actual)}</td></tr>)}</tbody></table></div>
      <h2>Latest results</h2><div className="card scroll"><table><thead><tr><th>MATCH</th><th>SCORE</th><th>HOME</th><th>DRAW</th><th>AWAY</th><th>FAVOURITE</th></tr></thead><tbody>{rows.slice(0, 15).map(r => <tr key={r.kickoff_utc + r.home_name}><td>{r.home_name} vs {r.away_name}</td><td className="n">{r.home_goals}-{r.away_goals}</td><td className="n">{p1(Number(r.p_home))}</td><td className="n">{p1(Number(r.p_draw))}</td><td className="n">{p1(Number(r.p_away))}</td><td style={{ color: r.correct ? "#00e676" : "#ff5d5d" }}>{r.correct ? "Right" : "Wrong"}</td></tr>)}</tbody></table></div></>}
  </>);
}
