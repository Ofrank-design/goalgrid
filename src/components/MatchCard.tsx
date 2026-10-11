import Link from "next/link";
import { Crest } from "./Crest";
import { kickoffLabel, matchHref, pct } from "@/lib/app/format";
import type { PredictedMatch } from "@/lib/engine/predictions";
import { marketsOf } from "@/lib/engine/markets";
import type { Prediction } from "@/types/prediction";

const pick = (q: { home: number; draw: number; away: number }) => { const best = Math.max(q.home, q.draw, q.away); return { side: best === q.home ? 0 : best === q.away ? 2 : 1, label: `${best === q.home ? "Home win" : best === q.away ? "Away win" : "Draw"} ${pct(best)}` }; };
const tick = (ok: boolean) => (ok ? "✓" : "✗");
const row = { display: "flex", flexWrap: "wrap" as const, gap: "4px 14px", fontSize: 12, opacity: 0.85, marginTop: 6 };

/** What the card says about a finished match: each market the prediction made, judged against the final score. Only for predictions stored before kickoff. */
function verdict(p: Prediction, home: number, away: number) {
  const o = home > away ? 0 : home === away ? 1 : 2, top = p.topScores?.[0] ?? p.mostLikelyScore;
  return { winner: pick(p.probabilities).side === o, btts: p.btts >= 0.5 === (home > 0 && away > 0), over25: p.over25 >= 0.5 === (home + away > 2), score: top.home === home && top.away === away };
}

export function MatchCard({ item, date }: { item: PredictedMatch; date: string }) {
  const { match: m, prediction: p, frozen } = item, crests = process.env.GOALGRID_ALLOW_CRESTS !== "false";
  const played = (m.status === "finished" || m.status === "live") && m.score.home != null && m.score.away != null, finished = m.status === "finished" && played;
  const mk = p ? marketsOf(p) : null, dc = mk ? { hd: mk.doubleChance.homeOrDraw, ad: mk.doubleChance.awayOrDraw, ha: mk.doubleChance.homeOrAway } : null;
  const v = p && finished && frozen ? verdict(p, m.score.home!, m.score.away!) : null, c = p?.context;
  return (
    <Link href={matchHref(m.id, date)} className="card link lux-surface" style={{ display: "block" }}>
      <div className="lh"><span>{m.league.name}</span><span style={{ marginLeft: "auto" }}>{m.status === "live" ? "LIVE" : finished ? "Full time" : kickoffLabel(m.kickoffUtc)}</span></div>
      <div className="teams">
        <div className="t"><Crest url={crests ? m.home.crestUrl : null} name={m.home.name} />{m.home.name}</div>
        <div className="score">{played ? `${m.score.home} - ${m.score.away}` : p ? `${(p.topScores?.[0] ?? p.mostLikelyScore).home} - ${(p.topScores?.[0] ?? p.mostLikelyScore).away}` : "vs"}<small>{played ? (finished ? "Final score" : "Live score") : p ? `Likeliest scoreline, ${pct((p.topScores?.[0] ?? p.mostLikelyScore).probability)}` : "No prediction"}</small></div>
        <div className="t"><Crest url={crests ? m.away.crestUrl : null} name={m.away.name} />{m.away.name}</div>
      </div>
      {p && mk ? <>
        <div className="pb" aria-hidden="true"><i style={{ flex: p.probabilities.home, background: "#00e676" }} /><i style={{ flex: p.probabilities.draw, background: "#456068" }} /><i style={{ flex: p.probabilities.away, background: "#35d4ee" }} /></div>
        <div className="pl"><div><b>{pct(p.probabilities.home)}</b>Home</div><div><b>{pct(p.probabilities.draw)}</b>Draw</div><div><b>{pct(p.probabilities.away)}</b>Away</div></div>
        <div className="meta"><span>Pick: {pick(p.probabilities).label}</span><span>{p.baseline ? "Baseline estimate" : `Evidence ${p.confidence}/100`}</span></div>
        {dc && mk && <div style={row}><span>Double chance: 1X {pct(dc.hd)}</span><span>X2 {pct(dc.ad)}</span><span>12 {pct(dc.ha)}</span></div>}
        <div style={row}><span>Both score: yes {pct(mk.bothTeamsToScore.ggYes)} / no {pct(mk.bothTeamsToScore.ggNo)}</span><span>xG {p.expectedGoals.home.toFixed(2)} - {p.expectedGoals.away.toFixed(2)}</span></div>
        <div style={row}><span>Over / under 1.5: {pct(mk.overallGoals.over15)} / {pct(mk.overallGoals.under15)}</span><span>2.5: {pct(mk.overallGoals.over25)} / {pct(mk.overallGoals.under25)}</span><span>3.5: {pct(mk.overallGoals.over35)} / {pct(mk.overallGoals.under35)}</span></div>
        {p.topScores && p.topScores.length > 0 && <div style={row}><span>Likeliest scores:</span>{p.topScores.map(s => <span key={`${s.home}-${s.away}`}>{s.home}-{s.away} {pct(s.probability)}</span>)}</div>}
        {c && (c.homeForm.played > 0 || c.awayForm.played > 0) && <div style={row}><span>Form {c.homeForm.form || "-"} vs {c.awayForm.form || "-"}</span>{c.h2h.meetings > 0 ? <span>H2H last {c.h2h.meetings}: {c.h2h.homeWins}W {c.h2h.draws}D {c.h2h.awayWins}L</span> : <span>No past meetings</span>}</div>}
        {v && <div style={{ ...row, opacity: 1, fontWeight: 600 }}><span>Scored:</span><span>Result {tick(v.winner)}</span><span>Both score {tick(v.btts)}</span><span>Over 2.5 {tick(v.over25)}</span><span>Exact score {tick(v.score)}</span></div>}
        {p.analysis && <p className="note" style={{ marginTop: 8 }}>{p.analysis.summary}</p>}
        {finished && !frozen && <p className="note" style={{ marginTop: 8 }}>Not scored: no prediction was stored before kickoff.</p>}
        {m.status === "live" && <p className="note" style={{ marginTop: 8 }}>Live: the pre-match prediction stays fixed and is scored at full time.</p>}
        {p.baseline && <p className="note" style={{ marginTop: 8 }}>{p.note}</p>}
      </> : <p className="note" style={{ marginTop: 12 }}>{item.reason ?? "Not enough data yet."}</p>}
    </Link>
  );
}
