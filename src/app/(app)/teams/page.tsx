import Link from "next/link";
import { Crest } from "@/components/Crest";
import { DataUnavailable } from "@/components/DataUnavailable";
import { LeagueBadge } from "@/components/LeagueBadge";
import { LEAGUES } from "@/lib/football/clubs";
import { getLeagueTeams } from "@/lib/football/teams";
export const metadata = { title: "Teams | GoalGrid" };
export const dynamic = "force-dynamic";
export default async function Teams() {
  // Teams, names and logos all come from the data providers. This page only reads the stored copy (refreshed nightly and whenever
  // a league page is opened), so it never waits on an API.
  const groups = await Promise.all(LEAGUES.map(async l => ({ l, teams: [...(await getLeagueTeams(l.slug, { cacheOnly: true }).catch(() => []))].sort((a, b) => a.name.localeCompare(b.name)) })));
  return (<>
    <div className="row"><div><h1>Teams</h1><p className="sub">Every team in the competitions we track, with logos and squads from the data providers. Open one for its season record, squad and next matches.</p></div><Link className="btn sm" href="/search">Search</Link></div>
    {groups.map(({ l, teams }) => <section key={l.slug}><h2 className="trow"><LeagueBadge slug={l.slug} size={34} />{l.name}</h2>
      {teams.length ? <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fill,minmax(210px,1fr))" }}>{teams.map(t => <Link key={t.providerId} href={`/teams/${t.slug}?league=${l.slug}`} className="card link trow"><Crest url={t.crestUrl} name={t.name} />{t.name}</Link>)}</div>
        : <><DataUnavailable title="Teams not loaded yet" text="They load from the data providers overnight, or right away when you open the league page." lines={2} /><p className="note"><Link href={`/leagues/${l.slug}`} style={{ color: "#00e676" }}>Open {l.name}</Link></p></>}
    </section>)}
  </>);
}
