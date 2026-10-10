import { LEAGUE_REGISTRY } from "@/lib/football/league-registry";
/** Pure planning for the fixtures fallback chain, kept apart from the network code so it can be tested. */
export interface PlanProvider { id: string; configured(): boolean }
/** Which registry key says "this provider can serve this competition". */
const KEY: Record<string, "fd" | "sm" | "bb" | "ts" | "af" | "ga"> = { "football-data": "fd", sportmonks: "sm", "big-balls": "bb", thestatsapi: "ts", "api-football": "af", "goal-api": "ga" };
export const coverage = (p: PlanProvider): string[] => { const k = KEY[p.id]; return k ? LEAGUE_REGISTRY.filter((l) => k in l).map((l) => l.slug) : []; };

/**
 * The priority route: football-data.org and Sportmonks first, then Big Balls and TheStatsAPI, then API-Football and GOAL API.
 * A provider in a later tier is only asked when it is needed, which keeps the small daily plans from being spent on duplicates:
 *   - nothing has come back yet (every earlier source errored or returned an empty list), or
 *   - it covers a competition that no earlier source that answered can serve (API-Football and the Danish league, say).
 */
export function selectProviders<T extends PlanProvider>(tier: readonly T[], answered: readonly PlanProvider[], haveMatches: boolean): T[] {
  const have = new Set(answered.flatMap(coverage));
  return tier.filter((p) => p.configured() && (!haveMatches || coverage(p).some((s) => !have.has(s))));
}
