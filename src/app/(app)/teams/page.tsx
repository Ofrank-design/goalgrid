import Link from "next/link";
import { Crest } from "@/components/Crest";
import { LeagueBadge } from "@/components/LeagueBadge";
import { clubsOf, LEAGUES } from "@/lib/football/clubs";
export const metadata = { title: "Teams | GoalGrid" };
export default function Teams() {
  return (<>
    <div className="row"><div><h1>Teams</h1><p className="sub">Every club in the five leagues. Open one for its season record, recent results and next matches.</p></div><Link className="btn sm" href="/search">Search</Link></div>
    {LEAGUES.map(l => <section key={l.slug}><h2 className="trow"><LeagueBadge slug={l.slug} size={34} />{l.name}</h2><div className="grid" style={{ gridTemplateColumns: "repeat(auto-fill,minmax(210px,1fr))" }}>{clubsOf(l.slug).map(c => <Link key={c.key} href={`/teams/${c.slug}`} className="card link trow"><Crest slug={c.slug} url={null} name={c.name} /><b>{c.name}</b></Link>)}</div></section>)}
  </>);
}
