import Link from "next/link";
import { MatchCard } from "@/components/MatchCard";
import { DateTabs } from "@/components/DateTabs";
import { groupByLeague, loadDay } from "@/lib/app/data";
import { todayUtc, validDate } from "@/lib/app/format";
import { getViewer } from "@/lib/app/session";
import { LuxuryReveal } from "@/components/LuxuryReveal";
export const dynamic = "force-dynamic";
export default async function Dashboard({ searchParams }: { searchParams: Promise<{ date?: string; league?: string; view?: string }> }) {
  const sp = await searchParams, date = validDate(sp.date) ?? todayUtc(), v = await getViewer(), day = await loadDay(date);
  const groups = day.ok ? groupByLeague(day.data.items) : [], liveOnly = sp.view === "live", sourceGroups = liveOnly ? groups.map(([slug, group]) => [slug, { ...group, items: group.items.filter((item) => item.match.status === "live") }] as const).filter(([, group]) => group.items.length) : groups, shown = sourceGroups.filter(([slug]) => !sp.league || slug === sp.league);
  return (<>
    <div className="row motion-header"><div><h1>{liveOnly ? "Live football" : "Today's football"}</h1><p className="sub">Probabilities from nine statistical models, with the evidence behind each. Predictions are probabilities, not guarantees.</p></div><span className={`badge ${v.tier}`}>{v.tier.toUpperCase()} MODE</span></div>
    <DateTabs base="/dashboard" date={date} extra={`${sp.league ? `&league=${sp.league}` : ""}${liveOnly ? "&view=live" : ""}`} />
    {liveOnly && <div className="live-status" aria-live="polite"><span className="live-status-dot" aria-hidden="true" />Live match feed</div>}
    {day.ok && groups.length > 0 && <div className="tabs"><Link className={`tab ${!sp.league ? "on" : ""}`} href={`/dashboard?date=${date}${liveOnly ? "&view=live" : ""}`}>All leagues</Link>{sourceGroups.map(([slug, g]) => <Link key={slug} className={`tab ${sp.league === slug ? "on" : ""}`} href={`/dashboard?date=${date}&league=${slug}`}>{g.name}</Link>)}</div>}
    {!day.ok && <div className="err">{day.error}</div>}
    {day.ok && day.data.stale && <p className="note">Showing the last available data while providers recover.</p>}
    {day.ok && groups.length === 0 && <div className="card"><p>No fixtures in the five tracked leagues on {date}.</p></div>}
    {shown.map(([slug, g]) => <LuxuryReveal key={slug}><section><h2>{g.name}</h2><div className="grid">{g.items.map(i => <LuxuryReveal key={i.match.id} className="lux-card"><MatchCard item={i} date={date} /></LuxuryReveal>)}</div></section></LuxuryReveal>)}
    {v.tier === "free" && <div className="card" style={{ marginTop: 34, display: "flex", gap: 16, justifyContent: "space-between", alignItems: "center", flexWrap: "wrap" }}><div><b>Want the full picture?</b><p className="note">Pro adds the probability center and model comparison. Premium adds AI analysis from five language models.</p></div><div className="chips"><Link className="btn sm" href="/pro">Pro</Link><Link className="btn sm" href="/premium">Premium</Link></div></div>}
  </>);
}
