import { NextResponse } from "next/server";

import { searchCommunityContent } from "@/lib/community/search";
import { LEAGUES, searchLeagues } from "@/lib/football/clubs";
import { searchSportmonksPlayers } from "@/lib/providers/sportmonks/players";
import { searchSquadPlayers, searchTeams } from "@/lib/football/teams";
import { TtlCache } from "@/lib/cache/ttl";
import { allowIp, tooMany } from "@/lib/security/limits";

export const dynamic = "force-dynamic";

/** Player search spends paid provider credits, so identical searches share one result for ten minutes and one call in flight. */
const playerCache = new TtlCache<Awaited<ReturnType<typeof searchSportmonksPlayers>>>(10 * 60_000, 500);
const CACHE_HEADERS = { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300" };

export async function GET(request: Request) {
  const q = new URL(request.url).searchParams.get("q")?.trim().slice(0, 60) ?? "";
  if (q.length < 2) {
    return NextResponse.json({ query: q, teams: [], leagues: [], players: [], community: [], playerSearchAvailable: false });
  }

  const rl = await allowIp(request, "search", 30, 60); if (!rl.ok) return tooMany("Too many searches. Please slow down.", rl.retryAfterSec);

  const playerKey = q.toLowerCase().normalize("NFKD").replace(/[^a-z0-9 ]+/g, "");
  const [teams, players, community] = await Promise.all([
    searchTeams(q, 8).catch(() => []),
    // Three characters is the shortest query worth a paid lookup; shorter ones are served from the local club and league lists.
    q.length >= 3 ? playerCache.remember(playerKey, async () => { const [squads, sm] = await Promise.all([searchSquadPlayers(q, 8).catch(() => []), process.env.SPORTMONKS_API_KEY ? searchSportmonksPlayers(q, 8).catch(() => []) : Promise.resolve([])]); return [...squads.map(p => ({ id: `${p.id}?team=${p.teamSlug}&league=${p.league}`, name: p.name, position: p.position, nationality: p.nationality, teamName: p.teamName, teamSlug: p.teamSlug, imageUrl: p.imageUrl })), ...sm].slice(0, 8); }) : Promise.resolve([]),
    searchCommunityContent(q, 8),
  ]);

  return NextResponse.json({
    query: q,
    teams: teams.map(({ t, league }) => ({ name: t.name, slug: t.slug, leagueSlug: league, league: LEAGUES.find((l) => l.slug === league)?.name ?? league, crestUrl: t.crestUrl })),
    leagues: searchLeagues(q).map((league) => ({ name: league.name, slug: league.slug, country: league.country })),
    players,
    community,
    playerSearchAvailable: Boolean(process.env.SPORTMONKS_API_KEY || process.env.FOOTBALL_DATA_API_KEY || process.env.API_FOOTBALL_KEY),
  }, { headers: CACHE_HEADERS });
}
