import { NextResponse } from "next/server";

import { searchCommunityContent } from "@/lib/community/search";
import { LEAGUES, searchClubs, searchLeagues } from "@/lib/football/clubs";
import { searchSportmonksPlayers } from "@/lib/providers/sportmonks/players";
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
    Promise.resolve(searchClubs(q, 8)),
    // Three characters is the shortest query worth a paid lookup; shorter ones are served from the local club and league lists.
    q.length >= 3 ? playerCache.remember(playerKey, () => searchSportmonksPlayers(q, 8)).catch(() => []) : Promise.resolve([]),
    searchCommunityContent(q, 8),
  ]);

  return NextResponse.json({
    query: q,
    teams: teams.map((club) => ({ name: club.name, slug: club.slug, league: LEAGUES.find((league) => league.slug === club.league)?.name ?? club.league })),
    leagues: searchLeagues(q).map((league) => ({ name: league.name, slug: league.slug, country: league.country })),
    players,
    community,
    playerSearchAvailable: Boolean(process.env.SPORTMONKS_API_KEY),
  }, { headers: CACHE_HEADERS });
}
