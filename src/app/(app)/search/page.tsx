import Link from "next/link";

import { Crest } from "@/components/Crest";
import { LeagueBadge } from "@/components/LeagueBadge";
import { LEAGUES, searchClubs, searchLeagues } from "@/lib/football/clubs";
import { searchCommunityContent } from "@/lib/community/search";
import { searchSportmonksPlayers } from "@/lib/providers/sportmonks/players";

export const metadata = { title: "Search | GoalGrid" };
export const dynamic = "force-dynamic";

export default async function Search({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const q = ((await searchParams).q ?? "").slice(0, 60);
  const clubs = searchClubs(q);
  const leagues = searchLeagues(q);
  const players = q.length >= 2 ? await searchSportmonksPlayers(q).catch(() => []) : [];
  const community = q.length >= 2 ? await searchCommunityContent(q).catch(() => []) : [];
  const hasResults = clubs.length || leagues.length || players.length || community.length;

  return <>
    <div className="row"><div><h1>Search GoalGrid</h1><p className="sub">Find teams, players, leagues and conversations from one place.</p></div><Link className="btn sm" href="/">Home</Link></div>
    <form action="/search" className="sf" style={{ margin: "16px 0 22px" }}>
      <input className="in" name="q" defaultValue={q} placeholder="Search teams, players, leagues or community" aria-label="Search teams, players, leagues or community" autoFocus />
      <button className="btn p" type="submit">Search</button>
    </form>
    {q.length < 2 && <div className="card"><p className="note">Try a team like “Arsenal”, a player like “Mbappé”, a league like “Bundesliga”, or a community username/topic.</p></div>}
    {q.length >= 2 && !hasResults && <div className="card"><p className="note">Nothing found for “{q}”.</p></div>}

    {leagues.length > 0 && <><h2>Leagues</h2><div className="grid">{leagues.map((league) => <Link key={league.slug} href={`/leagues/${league.slug}`} className="card link trow"><LeagueBadge slug={league.slug} /><div><b>{league.name}</b><div className="note">{league.country}</div></div></Link>)}</div></>}
    {clubs.length > 0 && <><h2>Teams</h2><div className="grid" style={{ gridTemplateColumns: "repeat(auto-fill,minmax(230px,1fr))" }}>{clubs.map((club) => <Link key={club.key} href={`/teams/${club.slug}`} className="card link trow"><Crest slug={club.slug} url={null} name={club.name} /><div><b>{club.name}</b><div className="note">{LEAGUES.find((league) => league.slug === club.league)?.name}</div></div></Link>)}</div></>}
    {players.length > 0 && <><h2>Players</h2><div className="grid">{players.map((player) => <Link key={player.id} href={`/players/${player.id}`} className="card link"><b>{player.name}</b><div className="meta"><span>{player.position ?? "Player"}</span>{player.teamName && <span>{player.teamName}</span>}{player.nationality && <span>{player.nationality}</span>}</div></Link>)}</div></>}
    {community.length > 0 && <><h2>Community</h2><div className="grid">{community.map((post) => <Link key={post.id} href={`/community?post=${encodeURIComponent(post.id)}`} className="card link"><b>@{post.username}</b><p className="note">{post.excerpt}</p></Link>)}</div></>}
    {!players.length && q.length >= 2 && !process.env.SPORTMONKS_API_KEY && <p className="note">Player search will appear when the Sportmonks player feed is connected.</p>}
  </>;
}
