import Link from "next/link";
import { Crest } from "@/components/Crest";
import { FormChips, LeagueBadge } from "@/components/LeagueBadge";
import { kickoffLabel, matchHref } from "@/lib/app/format";
import { LEAGUES, type LeagueKey } from "@/lib/football/clubs";
import { sameTeam } from "@/lib/football/team-resolver";
import { DataUnavailable } from "@/components/DataUnavailable";
import { teamForm, upcoming } from "@/lib/football/loaders";
import { findTeam, findTeamAnywhere, getLeagueTeams, getSquad, type SquadPlayer } from "@/lib/football/teams";
import { ageOf, sortSquad } from "@/lib/football/teams-normalize";
import { isLeagueSlug } from "@/lib/football/league-registry";
export const dynamic = "force-dynamic";
export const maxDuration = 60;
const nice = (s: string) => s.split("-").map(w => w[0]?.toUpperCase() + w.slice(1)).join(" ");
export default async function Team({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<{ league?: string }> }) {
  // The competition comes from the link (?league=), or is found in the stored team lists. Nothing is looked up in a built-in directory.
  const slug = (await params).slug, hinted = (await searchParams).league;
  const located = hinted && isLeagueSlug(hinted) ? { league: hinted, team: await findTeam(hinted, slug) } : await findTeamAnywhere(slug);
  if (!located?.team) return <><p className="note"><Link href="/teams" style={{ color: "#00e676" }}>All teams</Link></p><DataUnavailable title="Team not found" text="This team is not in the data loaded from the providers yet. Open it from its league page." /></>;
  const info = located.team, club = { slug: info.slug, name: info.name, league: located.league as LeagueKey }, league = LEAGUES.find(l => l.slug === club.league)!;
  const [squadResult, listResult] = await Promise.allSettled([getSquad(info, club.league), getLeagueTeams(club.league)]);
  const squad: SquadPlayer[] = squadResult.status === "fulfilled" ? squadResult.value : [], teamList = listResult.status === "fulfilled" ? listResult.value : [];
  const [f, fx] = await Promise.allSettled([teamForm(club.league, club.slug), upcoming(m => sameTeam(m.home.slug, club.slug) || sameTeam(m.away.slug, club.slug), 4)]);
  const form = f.status === "fulfilled" ? f.value : null, fixtures = fx.status === "fulfilled" ? fx.value : [], pos = form ? form.table.findIndex(r => sameTeam(r.slug, club.slug)) : -1, row = pos >= 0 ? form!.table[pos] : null, s = form?.summary;
  const split = (t: string, x: { p: number; w: number; d: number; l: number; gf: number; ga: number }) => <tr><td>{t}</td><td className="n">{x.p}</td><td className="n">{x.w}</td><td className="n">{x.d}</td><td className="n">{x.l}</td><td className="n">{x.gf}</td><td className="n">{x.ga}</td></tr>;
  return (<>
    <p className="note"><Link href="/teams" style={{ color: "#00e676" }}>All teams</Link></p>
    <div className="row" style={{ justifyContent: "flex-start", gap: 18, marginTop: 10 }}><span style={{ width: 72, height: 72, display: "grid", placeItems: "center" }}><Crest url={info?.crestUrl ?? null} name={club.name} /></span><div><h1>{club.name}</h1><Link href={`/leagues/${league.slug}`} className="trow note"><LeagueBadge slug={league.slug} size={28} />{league.name}{row ? `, ${pos + 1}${["th", "st", "nd", "rd"][((pos + 1) % 100 > 10 && (pos + 1) % 100 < 14) ? 0 : Math.min((pos + 1) % 10, 4) % 4]}` : ""}</Link></div></div>
    {!form ? <div style={{ marginTop: 18 }}><DataUnavailable title="Season data unavailable" text="This team's results are not available from the data providers right now." lines={4} /></div> : !row ? <div className="card" style={{ marginTop: 18 }}><p className="note">No matches played yet this season.</p></div> : <>
      <div className="grid" style={{ marginTop: 22, gridTemplateColumns: "repeat(auto-fill,minmax(150px,1fr))" }}>{[["Points", row.pts], ["Played", row.p], ["Record", `${row.w}-${row.d}-${row.l}`], ["Goals", `${row.gf}:${row.ga}`], ["Goal diff", row.gd > 0 ? `+${row.gd}` : row.gd]].map(([k, v]) => <div key={String(k)} className="card"><div className="note">{k}</div><div style={{ fontSize: 22, fontWeight: 800, marginTop: 4 }}>{v}</div></div>)}</div>
      <div className="cols" style={{ marginTop: 6 }}><div>
        <h2>Last five</h2><div className="card"><div style={{ marginBottom: 12 }}><FormChips form={row.form} /></div>{s!.last.map((r, i) => { const ot = teamList.find(x => sameTeam(x.slug, r.opponent)), on = ot?.name ?? nice(r.opponent); return <div key={i} className="row" style={{ margin: "0 0 8px" }}><span className="trow note">{r.date.slice(0, 10)}<Crest url={ot?.crestUrl} name={on} />{r.home ? "vs" : "at"} {on}</span><b style={{ color: r.result === "W" ? "#00e676" : r.result === "L" ? "#ff5d5d" : "#9fb2b8" }}>{r.gf}-{r.ga} {r.result}</b></div>; })}</div>
        <h2>Home and away</h2><div className="card scroll"><table><thead><tr><th></th><th>P</th><th>W</th><th>D</th><th>L</th><th>GF</th><th>GA</th></tr></thead><tbody>{split("Home", s!.home)}{split("Away", s!.away)}</tbody></table></div></div>
      <div><h2>Next matches</h2>{!fixtures.length ? <div className="card"><p className="note">No match in the next few days.</p></div> : <div style={{ display: "grid", gap: 10 }}>{fixtures.map(m => <Link key={m.id} href={matchHref(m.id, m.kickoffUtc.slice(0, 10))} className="card link" style={{ display: "block" }}><div className="lh"><span>{m.kickoffUtc.slice(0, 10)}</span><span style={{ marginLeft: "auto" }}>{kickoffLabel(m.kickoffUtc)}</span></div><b>{m.home.name} vs {m.away.name}</b></Link>)}</div>}</div></div></>}
    {squad.length === 0 && <><h2>Squad</h2><DataUnavailable title="Squad not available" text="The connected data plans did not return a squad for this team. It appears here when a provider supplies one." lines={4} /></>}
    {squad.length > 0 && <><h2>Squad</h2><div className="card scroll"><table><thead><tr><th>#</th><th>PLAYER</th><th>POSITION</th><th>NATIONALITY</th><th>AGE</th></tr></thead><tbody>{sortSquad(squad).map(p => <tr key={p.id}><td className="n">{p.shirtNumber ?? ""}</td><td><Link className="plain" href={`/players/${p.id}?team=${club.slug}&league=${club.league}`}>{p.name}</Link></td><td>{p.position ?? ""}</td><td>{p.nationality ?? ""}</td><td className="n">{ageOf(p.dateOfBirth) ?? ""}</td></tr>)}</tbody></table></div></>}
  </>);
}
