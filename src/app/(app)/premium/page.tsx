import Link from "next/link";
import { Gate } from "@/components/Gate";
import { DateTabs } from "@/components/DateTabs";
import { byKickoff, loadDay } from "@/lib/app/data";
import { kickoffLabel, matchHref, pct, todayUtc, validDate } from "@/lib/app/format";
import { getViewer } from "@/lib/app/session";
import { hasTier } from "@/lib/entitlements";
import { LuxuryReveal } from "@/components/LuxuryReveal";
export const dynamic = "force-dynamic";
export default async function Premium({ searchParams }: { searchParams: Promise<{ date?: string }> }) {
  const date = validDate((await searchParams).date) ?? todayUtc(), v = await getViewer();
  if (!hasTier(v.tier, "premium")) return <Gate need="premium" signedIn={v.signedIn} title="Explore the intelligence" blurb="Premium adds AI analysis from five language models, model disagreement and how each model has performed." />;
  const day = await loadDay(date), all = day.ok ? [...day.data.items].sort(byKickoff) : [], items = all.filter(i => i.prediction), pending = all.filter(i => !i.prediction), leagues = day.ok ? Object.entries(day.data.leagues) : [];
  return (<>
    <div className="row"><div><h1>Intelligence</h1><p className="sub">Open a match to run the AI analysis. Below: how each model performed on matches it had not seen.</p></div><span className="badge premium">PREMIUM</span></div>
    <DateTabs base="/premium" date={date} />
    {!day.ok && <div className="err">{day.error}</div>}
    {day.ok && !all.length && <div className="card">No fixtures found for {date}. Try another day.</div>}
    {pending.length > 0 && <><h2>Fixtures without a prediction yet</h2><div className="grid">{pending.map(({ match: m, reason }) => <Link key={m.id} href={matchHref(m.id, date)} className="card link"><div className="lh"><span>{m.league.name}</span><span style={{ marginLeft: "auto" }}>{kickoffLabel(m.kickoffUtc)}</span></div><b>{m.home.name} vs {m.away.name}</b><div className="meta"><span>{m.status}{m.score.home != null && m.score.away != null ? ` ${m.score.home}-${m.score.away}` : ""}</span><span>{reason ?? "Waiting for the models"}</span></div></Link>)}</div></>}
    {items.length > 0 && <><h2>Matches</h2><div className="grid">{items.map(({ match: m, prediction: p }) => p && <Link key={m.id} href={matchHref(m.id, date)} className="card link"><div className="lh"><span>{m.league.name}</span><span style={{ marginLeft: "auto" }}>{kickoffLabel(m.kickoffUtc)}</span></div><b>{m.home.name} vs {m.away.name}</b><div className="meta"><span>Model agreement {pct(p.agreement)}</span><span>Confidence {p.confidence}</span></div></Link>)}</div></>}
    {leagues.map(([slug, l]) => <section key={slug}><h2>Model performance: {slug.replace("-", " ")}</h2><p className="note">Fitted on {l.historyMatches} matches. Log loss is lower when better, 1.10 is the same as guessing.</p>
      <LuxuryReveal className="lux-card"><div className="card scroll"><table><thead><tr><th>MODEL</th><th>TYPE</th><th>WEIGHT</th><th>LOG LOSS</th><th>BRIER</th><th>TEST MATCHES</th></tr></thead><tbody>{l.metrics.map(x => <tr key={x.id}><td>{x.name}</td><td>{x.family}</td><td className="n">{x.weight.toFixed(2)}</td><td className="n">{x.logLoss == null ? "n/a" : x.logLoss.toFixed(3)}</td><td className="n">{x.brier == null ? "n/a" : x.brier.toFixed(3)}</td><td className="n">{x.testMatches}</td></tr>)}</tbody></table></div></LuxuryReveal></section>)}
  </>);
}