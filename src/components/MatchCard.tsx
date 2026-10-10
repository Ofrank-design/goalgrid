import Link from "next/link";
import { Crest } from "./Crest";
import { kickoffLabel, matchHref, pct } from "@/lib/app/format";
import type { PredictedMatch } from "@/lib/engine/predictions";
export function MatchCard({ item, date }: { item: PredictedMatch; date: string }) {
  const { match: m, prediction: p } = item, crests = process.env.GOALGRID_ALLOW_CRESTS !== "false";
  return (
    <Link href={matchHref(m.id, date)} className="card link lux-surface" style={{ display: "block" }}>
      <div className="lh"><span>{m.league.name}</span><span style={{ marginLeft: "auto" }}>{kickoffLabel(m.kickoffUtc)}</span></div>
      <div className="teams">
        <div className="t"><Crest url={crests ? m.home.crestUrl : null} name={m.home.name} />{m.home.name}</div>
        <div className="score">{p ? `${p.mostLikelyScore.home} - ${p.mostLikelyScore.away}` : "vs"}<small>{p ? "Predicted score" : "No prediction"}</small></div>
        <div className="t"><Crest url={crests ? m.away.crestUrl : null} name={m.away.name} />{m.away.name}</div>
      </div>
      {p ? <>
        <div className="pb" aria-hidden="true"><i style={{ flex: p.probabilities.home, background: "#00e676" }} /><i style={{ flex: p.probabilities.draw, background: "#456068" }} /><i style={{ flex: p.probabilities.away, background: "#35d4ee" }} /></div>
        <div className="pl"><div><b>{pct(p.probabilities.home)}</b>Home</div><div><b>{pct(p.probabilities.draw)}</b>Draw</div><div><b>{pct(p.probabilities.away)}</b>Away</div></div>
        <div className="meta"><span>Confidence {p.confidence}/100</span><span>Both score {pct(p.btts)}</span></div>
      </> : <p className="note" style={{ marginTop: 12 }}>{item.reason ?? "Not enough data yet."}</p>}
    </Link>
  );
}
