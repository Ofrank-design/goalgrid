import { notFound } from "next/navigation";
import Link from "next/link";
import { Crest } from "@/components/Crest";
import { AiPanel } from "@/components/AiPanel";
import { predictOne } from "@/lib/engine/predictions";
import { kickoffLabel, pct, todayUtc, validDate } from "@/lib/app/format";
import { getViewer } from "@/lib/app/session";
import { hasTier } from "@/lib/entitlements";
import { getMatchContext } from "@/lib/engine/ingestion/context";
import { SaveMatchButton } from "@/components/SaveMatchButton";
export const dynamic = "force-dynamic";
export default async function MatchPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ date?: string }> }) {
  const id = decodeURIComponent((await params).id), date = validDate((await searchParams).date) ?? todayUtc();
  if (!/^(sm|fd):\d+$/.test(id)) notFound();
  const [v, item0] = await Promise.all([getViewer(), predictOne(date, id).catch(() => "error" as const)]); if (item0 === "error") return <div className="err">Match data is unavailable right now. Check that a football data key is set.</div>;
  const item = item0; if (!item) return notFound();
  const { match: m, prediction: p } = item, pro = hasTier(v.tier, "pro"), crests = process.env.GOALGRID_ALLOW_CRESTS !== "false", ctx = await getMatchContext(m);
  return (<>
    <div className="row"><p className="note"><Link href={`/dashboard?date=${date}`} style={{ color: "#00e676" }}>Back to the dashboard</Link></p><div className="chips"><SaveMatchButton matchId={m.id} matchDate={date} /><Link className="chip" href={`/community/matches/${encodeURIComponent(m.id)}?date=${date}`}>Discussion</Link></div></div>
    <div className="card" style={{ marginTop: 12 }}><div className="lh"><span>{m.league.name}{m.matchday ? `, matchday ${m.matchday}` : ""}</span><span style={{ marginLeft: "auto" }}>{date}, {kickoffLabel(m.kickoffUtc)}</span></div>
      <div className="teams"><div className="t"><Crest slug={m.home.slug} url={crests ? m.home.crestUrl : null} name={m.home.name} />{m.home.name}</div>
        <div className="score">{m.status === "finished" ? `${m.score.home} - ${m.score.away}` : p ? `${p.mostLikelyScore.home} - ${p.mostLikelyScore.away}` : "vs"}<small>{m.status === "finished" ? "Final score" : "Predicted score"}</small></div>
        <div className="t"><Crest slug={m.away.slug} url={crests ? m.away.crestUrl : null} name={m.away.name} />{m.away.name}</div></div>
      {p ? <><div className="pb" aria-hidden="true"><i style={{ flex: p.probabilities.home, background: "#00e676" }} /><i style={{ flex: p.probabilities.draw, background: "#456068" }} /><i style={{ flex: p.probabilities.away, background: "#35d4ee" }} /></div>
        <div className="pl"><div><b>{pct(p.probabilities.home)}</b>Home win</div><div><b>{pct(p.probabilities.draw)}</b>Draw</div><div><b>{pct(p.probabilities.away)}</b>Away win</div></div>
        <div className="meta"><span>Expected goals {p.expectedGoals.home} to {p.expectedGoals.away}</span><span>Both score {pct(p.btts)}, over 2.5 {pct(p.over25)}</span></div>
        <div className="meta"><span>Confidence {p.confidence}/100 (model agreement and data volume, not accuracy)</span>{p.conformal && <span>Results that stay plausible (about {Math.round(p.conformal.coverage * 100)}% of the time): {p.conformal.set.map(k => k === "home" ? "Home win" : k === "away" ? "Away win" : "Draw").join(", ")}</span>}<span>{p.modelsUsed} of {p.modelsUsed + p.abstained.length} models</span></div></>
        : <p className="note" style={{ marginTop: 12 }}>{item.reason ?? "Not enough data for a prediction yet."}</p>}</div>
    <div className="cols">
      <div>
        {p && <><h2>Models</h2>{pro ? <div className="card scroll"><table><thead><tr><th>MODEL</th><th>WEIGHT</th><th>HOME</th><th>DRAW</th><th>AWAY</th></tr></thead><tbody>{p.models.map(x => <tr key={x.id}><td>{x.name}</td><td className="n">{pct(x.weight)}</td><td className="n">{pct(x.home)}</td><td className="n">{pct(x.draw)}</td><td className="n">{pct(x.away)}</td></tr>)}</tbody></table></div>
          : <div className="card"><p className="note">Model by model comparison is free with an account. <Link href="/sign-in?next=/dashboard" style={{ color: "#35d4ee" }}>Sign in</Link></p></div>}</>}
        {pro && p && p.abstained.length > 0 && <details><summary>{p.abstained.length} of {p.modelsUsed + p.abstained.length} models waiting for data</summary><ul style={{ paddingLeft: 18, display: "grid", gap: 4 }}>{p.abstained.map(a => <li key={a.id} className="note"><b>{a.name}</b>: needs {a.reason}</li>)}</ul></details>}
        <h2>AI analysis</h2><div className="card">{pro && p ? <AiPanel date={date} id={m.id} /> : <p className="note">AI analysis is free with an account. <Link href="/sign-in?next=/dashboard" style={{ color: "#35d4ee" }}>Sign in</Link></p>}</div>
      </div>
      <div>
        <h2>Market</h2><div className="card">{pro ? (ctx.market ? <><div className="pl"><div><b>{pct(ctx.market.impliedProbabilities.home)}</b>Home</div><div><b>{pct(ctx.market.impliedProbabilities.draw)}</b>Draw</div><div><b>{pct(ctx.market.impliedProbabilities.away)}</b>Away</div></div><p className="note" style={{ marginTop: 10 }}>{ctx.market.bookmakers} bookmakers, margin removed.</p></> : <p className="note">No odds listed for this fixture.</p>) : <p className="note">The market view is part of Pro.</p>}</div>
        <h2>Conditions</h2><div className="card">{ctx.weather ? <p>{Math.round(ctx.weather.tempC)} degrees C, wind {Math.round(ctx.weather.windKmh)} km/h, humidity {ctx.weather.humidityPct}%{ctx.weather.rainChancePct != null ? `, rain chance ${ctx.weather.rainChancePct}%` : ""}</p> : <p className="note">No forecast available for this fixture.</p>}</div>
        <h2>News</h2><div className="card">{ctx.news.length ? <ul style={{ paddingLeft: 18, display: "grid", gap: 8 }}>{ctx.news.map(n => <li key={n.id}><a href={n.url} target="_blank" rel="noopener noreferrer" style={{ color: "#00e676" }}>{n.title}</a> <span className="note">{n.source}</span></li>)}</ul> : <p className="note">No recent articles found.</p>}</div>
      </div>
    </div>
  </>);
}
