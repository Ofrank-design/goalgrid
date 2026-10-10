import "server-only";
import { cached } from "@/lib/cache";
import { fetchSeasonResults, footballData } from "@/lib/providers/football-data";
import { apiFootball, fetchApiFootballSeason } from "@/lib/providers/api-football";
import { sportmonks, fetchSportmonksSeason } from "@/lib/providers/sportmonks";
import { log } from "@/lib/logging/logger";
import { currentSeason, leagueEntry } from "@/lib/football/league-registry";
import type { LeagueSlug } from "@/types/football";
import type { HistMatch } from "@/types/prediction";

/**
 * One season of results, from the first provider that has any: football-data.org for the competitions it covers, then Sportmonks
 * (the Danish and Scottish leagues), then API-Football. A provider that errors or comes back empty just passes to the next one.
 */
async function seasonResults(league: LeagueSlug, season: number): Promise<HistMatch[]> {
  const entry = leagueEntry(league), sources: { id: string; run: () => Promise<HistMatch[]> }[] = [];
  if (entry?.fd && footballData.configured()) sources.push({ id: "football-data", run: () => fetchSeasonResults(league, season) });
  if (entry?.sm && sportmonks.configured()) sources.push({ id: "sportmonks", run: () => fetchSportmonksSeason(league, season) });
  if (entry?.af && apiFootball.configured()) sources.push({ id: "api-football", run: () => fetchApiFootballSeason(league, season) });
  for (const s of sources) {
    try { const r = await s.run(); if (r.length) return r; }
    catch (e) { log.warn("history source failed", { league, season, provider: s.id, message: (e as Error).message }); }
  }
  return [];
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