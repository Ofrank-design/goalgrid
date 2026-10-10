import "server-only";
import { cached } from "@/lib/cache";
import { fetchSeasonResults, footballData } from "@/lib/providers/football-data";
import { apiFootball, fetchApiFootballSeason } from "@/lib/providers/api-football";
import { currentSeason, leagueEntry } from "@/lib/football/league-registry";
import type { LeagueSlug } from "@/types/football";
import type { HistMatch } from "@/types/prediction";

/** One season of results: football-data.org when it covers the competition, API-Football when it does not (or comes back empty). */
async function seasonResults(league: LeagueSlug, season: number): Promise<HistMatch[]> {
  const entry = leagueEntry(league);
  let first: HistMatch[] = [];
  if (entry?.fd && footballData.configured()) {
    try { first = await fetchSeasonResults(league, season); } catch { /* fall through to the next provider */ }
  }
  if (first.length || !entry?.af || !apiFootball.configured()) return first;
  try { return await fetchApiFootballSeason(league, season); } catch { return []; }
}

/** The current and previous season, so the models have enough matches early in a campaign. Time decay favours the recent ones. */
export async function getHistory(league: LeagueSlug): Promise<HistMatch[]> {
  const entry = leagueEntry(league), season = entry ? currentSeason(entry) : new Date().getUTCFullYear() - 1;
  const { value } = await cached(`history:${league}:${season}`, 20 * 60_000, 72 * 3_600_000, async () => {
    const parts = await Promise.allSettled([seasonResults(league, season - 1), seasonResults(league, season)]);
    const ok = parts.flatMap(p => (p.status === "fulfilled" ? p.value : []));
    if (!ok.length) throw new Error(`No history available for ${league}`);
    return ok;
  });
  return value;
}
