import Link from "next/link";
import { notFound } from "next/navigation";
import { Crest } from "@/components/Crest";
import { FormChips, LeagueBadge } from "@/components/LeagueBadge";
import { kickoffLabel, matchHref } from "@/lib/app/format";
import { clubBySlug, LEAGUES, sameClub } from "@/lib/football/clubs";
import { teamForm, upcoming } from "@/lib/football/loaders";
export const dynamic = "force-dynamic";
export const maxDuration = 60;
const nice = (s: string) => s.split("-").map(w => w[0]?.toUpperCase() + w.slice(1)).join(" ");
export default async function Team({ params }: { params: Promise<{ slug: string }> }) {
  const club = clubBySlug((await params).slug); if (!club) return notFound(); const league = LEAGUES.find(l => l.slug === club.league)!;
  const [f, fx] = await Promise.allSettled([teamForm(club.league, club.slug), upcoming(m => sameClub(m.home.slug, club.slug) || sameClub(m.away.slug, club.slug), 4)]);
  const form = f.status === "fulfilled" ? f.value : null, fixtures = fx.status === "fulfilled" ? fx.value : [], pos = form ? form.table.findIndex(r => sameClub(r.slug, club.slug)) : -1, row = pos >= 0 ? form!.table[pos] : null, s = form?.summary;
  const split = (t: string, x: { p: number; w: number; d: number; l: number; gf: number; ga: number }) => <tr><td>{t}</td><td className="n">{x.p}</td><td className="n">{x.w}</td><td className="n">{x.d}</td><td className="n">{x.l}</td><td className="n">{x.gf}</td><td className="n">{x.ga}</td></tr>;
  return (<>
    <p className="note"><Link href="/teams" style={{ color: "#00e676" }}>All teams</Link></p>
    <div className="row" style={{ justifyContent: "flex-start", gap: 18, marginTop: 10 }}><span style={{ width: 72, height: 72, display: "grid", placeItems: "center" }}><Crest slug={club.slug} url={null} name={club.name} /></span><div><h1>{club.name}</h1><Link href={`/leagues/${league.slug}`} className="trow note"><LeagueBadge slug={league.slug} size={28} />{league.name}{row ? `, ${pos + 1}${["th", "st", "nd", "rd"][((pos + 1) % 100 > 10 && (pos + 1) % 100 < 14) ? 0 : Math.min((pos + 1) % 10, 4) % 4]}` : ""}</Link></div></div>
    {!form ? <div className="err" style={{ marginTop: 18 }}>Season data is unavailable right now. Check the football data key.</div> : !row ? <div className="card" style={{ marginTop: 18 }}><p className="note">No matches played yet this season.</p></div> : <>
      <div className="grid" style={{ marginTop: 22, gridTemplateColumns: "repeat(auto-fill,minmax(150px,1fr))" }}>{[["Points", row.pts], ["Played", row.p], ["Record", `${row.w}-${row.d}-${row.l}`], ["Goals", `${row.gf}:${row.ga}`], ["Goal diff", row.gd > 0 ? `+${row.gd}` : row.gd]].map(([k, v]) => <div key={String(k)} className="card"><div className="note">{k}</div><div style={{ fontSize: 22, fontWeight: 800, marginTop: 4 }}>{v}</div></div>)}</div>
      <div className="cols" style={{ marginTop: 6 }}><div>
        <h2>Last five</h2><div className="card"><div style={{ marginBottom: 12 }}><FormChips form={row.form} /></div>{s!.last.map((r, i) => { const c = clubBySlug(r.opponent); return <div key={i} className="row" style={{ margin: "0 0 8px" }}><span className="trow note">{r.date.slice(0, 10)}<Crest slug={r.opponent} url={null} name={c?.name ?? nice(r.opponent)} />{r.home ? "vs" : "at"} {c?.name ?? nice(r.opponent)}</span><b style={{ color: r.result === "W" ? "#00e676" : r.result === "L" ? "#ff5d5d" : "#9fb2b8" }}>{r.gf}-{r.ga} {r.result}</b></div>; })}</div>
        <h2>Home and away</h2><div className="card scroll"><table><thead><tr><th></th><th>P</th><th>W</th><th>D</th><th>L</th><th>GF</th><th>GA</th></tr></thead><tbody>{split("Home", s!.home)}{split("Away", s!.away)}</tbody></table></div></div>
      <div><h2>Next matches</h2>{!fixtures.length ? <div className="card"><p className="note">No match in the next few days.</p></div> : <div style={{ display: "grid", gap: 10 }}>{fixtures.map(m => <Link key={m.id} href={matchHref(m.id, m.kickoffUtc.slice(0, 10))} className="card link" style={{ display: "block" }}><div className="lh"><span>{m.kickoffUtc.slice(0, 10)}</span><span style={{ marginLeft: "auto" }}>{kickoffLabel(m.kickoffUtc)}</span></div><b>{m.home.name} vs {m.away.name}</b></Link>)}</div>}</div></div></>}
  </>);
}
