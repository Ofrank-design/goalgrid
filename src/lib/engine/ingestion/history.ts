import "server-only";
import { cached } from "@/lib/cache";
import { fetchSeasonResults } from "@/lib/providers/football-data";
import type { LeagueSlug } from "@/types/football";
import type { HistMatch } from "@/types/prediction";
/** The current and previous season, so the models have enough matches early in a campaign. Time decay favours the recent ones. */
export async function getHistory(league: LeagueSlug): Promise<HistMatch[]> {
  const d = new Date(), season = d.getUTCMonth() >= 6 ? d.getUTCFullYear() : d.getUTCFullYear() - 1;
  const { value } = await cached(`history:${league}:${season}`, 12 * 3_600_000, 72 * 3_600_000, async () => {
    const parts = await Promise.allSettled([fetchSeasonResults(league, season - 1), fetchSeasonResults(league, season)]);
    const ok = parts.flatMap(p => (p.status === "fulfilled" ? p.value : []));
    if (!ok.length) throw new Error(`No history available for ${league}`);
    return ok;
  });
  return value;
}
