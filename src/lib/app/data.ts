import "server-only";
import { getPredictions, type PredictedMatch, type PredictionsResult } from "@/lib/engine/predictions";
export type DayData = { ok: true; data: PredictionsResult } | { ok: false; error: string };
/** Pages call the engine directly on the server. A provider outage becomes a readable message, not a crash. */
export async function loadDay(date: string): Promise<DayData> {
  try { return { ok: true, data: await getPredictions(date) }; }
  catch { return { ok: false, error: "Match data is unavailable right now. Check that the Sportmonks or football-data.org key is set." }; }
}
export const byKickoff = (a: PredictedMatch, b: PredictedMatch) => a.match.kickoffUtc.localeCompare(b.match.kickoffUtc);
export function groupByLeague(items: PredictedMatch[]) { const m = new Map<string, { name: string; items: PredictedMatch[] }>(); for (const i of [...items].sort(byKickoff)) { const g = m.get(i.match.league.slug) ?? { name: i.match.league.name, items: [] }; g.items.push(i); m.set(i.match.league.slug, g); } return [...m.entries()]; }
