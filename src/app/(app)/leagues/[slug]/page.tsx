import Link from "next/link";
import { notFound } from "next/navigation";
import { Crest } from "@/components/Crest";
import { FormChips, LeagueBadge } from "@/components/LeagueBadge";
import { kickoffLabel, matchHref } from "@/lib/app/format";
import { clubBySlug, LEAGUES } from "@/lib/football/clubs";
import { leagueTable, upcoming } from "@/lib/football/loaders";
export const dynamic = "force-dynamic";
export const maxDuration = 60;
const nice = (s: string) => s.split("-").map(w => w[0]?.toUpperCase() + w.slice(1)).join(" ");
export default async function League({ params }: { params: Promise<{ slug: string }> }) {
  const slug = (await params).slug, meta = LEAGUES.find(l => l.slug === slug); if (!meta) return notFound();
  const [t, fx] = await Promise.allSettled([leagueTable(meta.slug), upcoming(m => m.league.slug === meta.slug)]), table = t.status === "fulfilled" ? t.value : null, fixtures = fx.status === "fulfilled" ? fx.value : [];
  return (<>
    <div className="row" style={{ justifyContent: "flex-start", gap: 16 }}><LeagueBadge slug={meta.slug} size={64} /><div><h1>{meta.name}</h1><p className="sub">{meta.country}. Standings are calculated from this season's results.</p></div></div>
    <h2>Next fixtures</h2>
    {!fixtures.length ? <div className="card"><p className="note">No fixtures in the next three days, or fixture data is unavailable right now.</p></div> : <div className="grid">{fixtures.map(m => <Link key={m.id} href={matchHref(m.id, m.kickoffUtc.slice(0, 10))} className="card link" style={{ display: "block" }}><div className="lh"><span>{m.kickoffUtc.slice(0, 10)}</span><span style={{ marginLeft: "auto" }}>{kickoffLabel(m.kickoffUtc)}</span></div><div className="trow"><Crest slug={m.home.slug} url={m.home.crestUrl} name={m.home.name} /><b>{m.home.name}</b></div><div className="trow" style={{ marginTop: 6 }}><Crest slug={m.away.slug} url={m.away.crestUrl} name={m.away.name} /><b>{m.away.name}</b></div></Link>)}</div>}
    <h2>Table</h2>
    {!table ? <div className="err">The table is unavailable right now. Check the football data key.</div> : !table.length ? <div className="card"><p className="note">No matches played yet this season.</p></div> : <div className="card scroll"><table><thead><tr><th>#</th><th>TEAM</th><th>P</th><th>W</th><th>D</th><th>L</th><th>GF</th><th>GA</th><th>GD</th><th>PTS</th><th>FORM</th></tr></thead><tbody>
      {table.map((r, i) => { const c = clubBySlug(r.slug); return <tr key={r.slug}><td className="n">{i + 1}</td><td><span className="trow"><Crest slug={r.slug} url={null} name={c?.name ?? nice(r.slug)} />{c ? <Link className="plain" href={`/teams/${c.slug}`}>{c.name}</Link> : nice(r.slug)}</span></td><td className="n">{r.p}</td><td className="n">{r.w}</td><td className="n">{r.d}</td><td className="n">{r.l}</td><td className="n">{r.gf}</td><td className="n">{r.ga}</td><td className="n">{r.gd > 0 ? `+${r.gd}` : r.gd}</td><td className="n"><b>{r.pts}</b></td><td><FormChips form={r.form} /></td></tr>; })}</tbody></table></div>}
    <p className="note" style={{ marginTop: 10 }}>Sorted by points, goal difference, then goals scored. Official tie-breaks can differ for teams level on all three.</p>
  </>);
}
