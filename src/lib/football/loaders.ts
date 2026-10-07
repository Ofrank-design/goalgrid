import "server-only";
import { getFixtures } from "@/lib/engine/ingestion/fixtures";
import { getHistory } from "@/lib/engine/ingestion/history";
import { shiftDate, todayUtc } from "@/lib/app/format";
import type { Match } from "@/types/football";
import { LeagueKey, sameClub } from "./clubs";
import { computeTable, seasonStart, teamSummary } from "./table";
/** Standings and team form are computed from the season's results, so they need no extra data source. They are cached for 12 hours with the match history. */
export async function leagueTable(league: LeagueKey) { return computeTable(await getHistory(league), seasonStart()); }
export async function teamForm(league: LeagueKey, slug: string) { const h = await getHistory(league), since = seasonStart(); return { table: computeTable(h, since), summary: teamSummary(h, s => sameClub(s, slug), since) }; }
/** Upcoming fixtures for the next few days, optionally filtered. A failed day is skipped, not fatal. */
export async function upcoming(filter: (m: Match) => boolean, days = 3): Promise<Match[]> {
  const out: Match[] = [];
  for (let i = 0; i < days; i++) { try { out.push(...(await getFixtures(shiftDate(todayUtc(), i))).matches.filter(m => m.status === "scheduled" || m.status === "live").filter(filter)); } catch { /* skip this day */ } }
  return out.sort((a, b) => a.kickoffUtc.localeCompare(b.kickoffUtc));
}
