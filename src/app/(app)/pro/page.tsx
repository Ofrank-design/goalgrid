import Link from "next/link";
import { Gate } from "@/components/Gate";
import { DateTabs } from "@/components/DateTabs";
import { byKickoff, loadDay } from "@/lib/app/data";
import { kickoffLabel, matchHref, pct, todayUtc, validDate } from "@/lib/app/format";
import { getViewer } from "@/lib/app/session";
import { hasTier } from "@/lib/entitlements";
import { LuxuryReveal } from "@/components/LuxuryReveal";
export const dynamic = "force-dynamic";
export default async function Pro({ searchParams }: { searchParams: Promise<{ date?: string }> }) {
  const date = validDate((await searchParams).date) ?? todayUtc(), v = await getViewer();
  if (!hasTier(v.tier, "pro")) return <Gate need="pro" signedIn={v.signedIn} title="Understand why" blurb="Pro opens the full probability center, model by model comparison, expected goals and the market view." />;
  const day = await loadDay(date), all = day.ok ? [...day.data.items].sort(byKickoff) : [], items = all.filter(i => i.prediction), pending = all.filter(i => !i.prediction);
  return (<>
    <div className="row"><div><h1>Probability center</h1><p className="sub">Every model, side by side. Where they disagree, treat the result with more caution.</p></div><span className="badge pro">PRO</span></div>
    <DateTabs base="/pro" date={date} />
    {!day.ok && <div className="err">{day.error}</div>}
    {day.ok && !all.length && <div className="card">No fixtures found for {date}. Try another day.</div>}
    {day.ok && all.length > 0 && !items.length && <div className="card">{all.length} fixtures found for {date}, but no predictions yet. The reason is listed below for each match.</div>}
    {items.length > 0 && <LuxuryReveal className="lux-card"><div className="card scroll"><table><thead><tr><th>MATCH</th><th>KICKOFF</th><th>HOME</th><th>DRAW</th><th>AWAY</th><th>xG</th><th>BTTS</th><th>O2.5</th><th>AGREE</th><th>VS MARKET</th></tr></thead><tbody>
      {items.map(({ match: m, prediction: p }) => p && <tr key={m.id}><td><Link href={matchHref(m.id, date)} style={{ color: "#00e676" }}>{m.home.name} vs {m.away.name}</Link></td><td>{kickoffLabel(m.kickoffUtc)}</td>
        <td className="n">{pct(p.probabilities.home)}</td><td className="n">{pct(p.probabilities.draw)}</td><td className="n">{pct(p.probabilities.away)}</td><td className="n">{p.expectedGoals.home}-{p.expectedGoals.away}</td><td className="n">{pct(p.btts)}</td><td className="n">{pct(p.over25)}</td><td className="n">{pct(p.agreement)}</td><td className="n">{p.marketGap == null ? "n/a" : `${(p.marketGap * 100).toFixed(1)} pts`}</td></tr>)}
    </tbody></table></div></LuxuryReveal>}
    {pending.length > 0 && <><h2>Fixtures without a prediction yet</h2><div className="card scroll"><table><thead><tr><th>MATCH</th><th>LEAGUE</th><th>KICKOFF</th><th>STATUS</th><th>SCORE</th><th>REASON</th></tr></thead><tbody>
      {pending.map(({ match: m, reason }) => <tr key={m.id}><td><Link href={matchHref(m.id, date)} style={{ color: "#00e676" }}>{m.home.name} vs {m.away.name}</Link></td><td>{m.league.name}</td><td>{kickoffLabel(m.kickoffUtc)}</td><td>{m.status}</td><td className="n">{m.score.home ?? "-"}-{m.score.away ?? "-"}</td><td>{reason ?? "Waiting for the models"}</td></tr>)}
    </tbody></table></div></>}
    {items.map(({ match: m, prediction: p }) => p && <details key={m.id}><summary>{m.home.name} vs {m.away.name}: model breakdown</summary><div className="scroll"><table><thead><tr><th>MODEL</th><th>TYPE</th><th>WEIGHT</th><th>HOME</th><th>DRAW</th><th>AWAY</th></tr></thead><tbody>{p.models.map(x => <tr key={x.id}><td>{x.name}</td><td>{x.family}</td><td className="n">{pct(x.weight)}</td><td className="n">{pct(x.home)}</td><td className="n">{pct(x.draw)}</td><td className="n">{pct(x.away)}</td></tr>)}</tbody></table></div></details>)}
  </>);
}