import "server-only";
import { cached } from "@/lib/cache";
import { log } from "@/lib/logging/logger";
import { readLeagueCache, writeLeagueCache } from "@/lib/engine/predictions/store";
import { footballData } from "@/lib/providers/football-data";
import { fetchCompetitionTeams, fetchFdSquad } from "@/lib/providers/football-data/teams";
import { apiFootball } from "@/lib/providers/api-football";
import { fetchAfLeagueTeams, fetchAfSquad } from "@/lib/providers/api-football/teams";
import { footballDataBatch } from "@/lib/providers/queue";
import { LEAGUE_REGISTRY, currentSeason, leagueEntry } from "./league-registry";
import { resolveTeam, sameTeam } from "./team-resolver";
import type { SquadPlayer, TeamInfo } from "./teams-normalize";

export type { SquadPlayer, TeamInfo } from "./teams-normalize";
const DAY = 24 * 3_600_000;

/** Fetch one competition's teams from the providers: football-data.org first, API-Football when it has none. */
async function fetchTeams(league: string, viaBatch: boolean): Promise<TeamInfo[]> {
  const entry = leagueEntry(league); if (!entry) return [];
  const season = currentSeason(entry);
  let teams: TeamInfo[] = [];
  if (entry.fd && footballData.configured()) {
    try { teams = await (viaBatch ? footballDataBatch.run(() => fetchCompetitionTeams(entry.fd!, season)) : fetchCompetitionTeams(entry.fd, season)); }
    catch (e) { log.warn("football-data teams failed", { league, message: (e as Error).message }); }
  }
  if (!teams.length && entry.af && apiFootball.configured()) {
    try { teams = await fetchAfLeagueTeams(entry.af, season); }
    catch (e) { log.warn("api-football teams failed", { league, message: (e as Error).message }); }
  }
  return teams;
}

/**
 * The teams of one competition, with logos and (where the provider includes them) squads.
 * Stored copies are good for 24 hours; after that the providers are asked again, and if they fail the older copy (up to a week)
 * is served instead. `cacheOnly` never calls a provider.
 */
export async function getLeagueTeams(league: string, opts: { cacheOnly?: boolean } = {}): Promise<TeamInfo[]> {
  if (!leagueEntry(league)) return [];
  const fresh = await readLeagueCache<TeamInfo[]>(league, "teams", DAY);
  if (fresh?.length) return fresh;
  if (opts.cacheOnly) return (await readLeagueCache<TeamInfo[]>(league, "teams", 7 * DAY)) ?? [];
  const { value } = await cached(`teams:${league}`, 30 * 60_000, 3 * DAY, async () => {
    const teams = await fetchTeams(league, false);
    if (teams.length) { await writeLeagueCache(league, "teams", teams); return teams; }
    const old = await readLeagueCache<TeamInfo[]>(league, "teams", 7 * DAY);
    if (old?.length) return old;
    throw new Error(`No teams available for ${league}`);
  });
  return value;
}

/**
 * Nightly warm-up: refreshes the stored team lists one competition at a time through the throttle queue (6.5 seconds between
 * football-data.org requests) and stops when the time budget is spent. Whatever is left is picked up the next night.
 */
export async function warmTeams(budgetMs = 40_000): Promise<{ refreshed: number; failed: number; fresh: number; left: number }> {
  const started = Date.now(); let refreshed = 0, failed = 0, fresh = 0, left = 0;
  for (const l of LEAGUE_REGISTRY) {
    if ((await readLeagueCache<TeamInfo[]>(l.slug, "teams", DAY))?.length) { fresh++; continue; }
    if (Date.now() - started > budgetMs) { left++; continue; }
    const teams = await fetchTeams(l.slug, true);
    if (teams.length) { await writeLeagueCache(l.slug, "teams", teams); refreshed++; } else failed++;
  }
  return { refreshed, failed, fresh, left };
}

/** The same club in API-Football's list, matched by name, so a squad can come from either provider. */
async function afIdFor(team: TeamInfo, league: string): Promise<string | null> {
  const entry = leagueEntry(league); if (!entry?.af || !apiFootball.configured()) return null;
  const { value } = await cached(`af-teams:${league}`, DAY, 7 * DAY, () => fetchAfLeagueTeams(entry.af!, currentSeason(entry)));
  return resolveTeam(team.name, value)?.providerId ?? null;
}

/**
 * A team's squad: from the team list when the provider included it, otherwise from football-data.org (/teams/{id}), and when
 * that is empty or refused, from API-Football (/players/squads) using the club matched by name.
 */
export async function getSquad(team: TeamInfo, league: string): Promise<SquadPlayer[]> {
  if (team.squad.length) return team.squad;
  const { value } = await cached(`squad:${team.source}:${team.providerId}`, DAY, 7 * DAY, async () => {
    if (team.source === "football-data") {
      try { const s = await fetchFdSquad(team.providerId); if (s.length) return s; }
      catch (e) { log.warn("football-data squad failed", { team: team.slug, message: (e as Error).message }); }
      const afId = await afIdFor(team, league).catch(() => null);
      if (afId) return fetchAfSquad(afId);
      return [];
    }
    return fetchAfSquad(team.providerId);
  });
  return value;
}

export async function findTeam(league: string, slug: string): Promise<TeamInfo | null> {
  try { return (await getLeagueTeams(league)).find((t) => sameTeam(t.slug, slug)) ?? null; } catch { return null; }
}
/** A team link without a competition in it: look the slug up in every stored team list. */
export async function findTeamAnywhere(slug: string): Promise<{ team: TeamInfo; league: string } | null> {
  for (const l of LEAGUE_REGISTRY) { const t = (await getLeagueTeams(l.slug, { cacheOnly: true }).catch(() => [])).find((x) => x.slug === slug); if (t) return { team: t, league: l.slug }; }
  return null;
}
export { crestOf } from "./teams-normalize";

const fold = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9 ]+/g, " ").replace(/\s+/g, " ").trim();
async function allStored() {
  const { value } = await cached("teams:all", 15 * 60_000, 3_600_000, async () =>
    (await Promise.all(LEAGUE_REGISTRY.map(async (l) => (await getLeagueTeams(l.slug, { cacheOnly: true }).catch(() => [])).map((t) => ({ t, league: l.slug }))))).flat());
  return value;
}
/** Team search over the stored lists. It never calls a provider, so it stays instant and costs no credits. */
export async function searchTeams(q: string, limit = 8) {
  const n = fold(q); if (n.length < 2) return [];
  const score = (name: string) => { const f = fold(name); return f.startsWith(n) ? 0 : f.split(" ").some((w) => w.startsWith(n)) ? 1 : f.includes(n) ? 2 : 9; };
  return (await allStored()).map((x) => ({ ...x, s: Math.min(score(x.t.name), x.t.shortName ? score(x.t.shortName) : 9) })).filter((x) => x.s < 9).sort((a, b) => a.s - b.s || a.t.name.localeCompare(b.t.name)).slice(0, limit);
}

export interface FoundPlayer { id: string; name: string; position: string | null; nationality: string | null; teamName: string; teamSlug: string; league: string; imageUrl: string | null }
/** Players in the squads already stored. Same rule: no provider calls. */
export async function searchSquadPlayers(q: string, limit = 8): Promise<FoundPlayer[]> {
  const n = fold(q); if (n.length < 3) return [];
  const hits = (await allStored()).flatMap(({ t, league }) => t.squad.map((p) => ({ p, t, league, key: fold(p.name) }))).filter((x) => x.key.includes(n))
    .sort((a, b) => Number(b.key.startsWith(n)) - Number(a.key.startsWith(n)) || a.p.name.localeCompare(b.p.name)).slice(0, limit);
  return hits.map(({ p, t, league }) => ({ id: p.id, name: p.name, position: p.position, nationality: p.nationality, teamName: t.name, teamSlug: t.slug, league, imageUrl: p.photoUrl }));
}
