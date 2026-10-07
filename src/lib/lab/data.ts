import "server-only";
import { supabaseAdmin } from "@/lib/supabase/admin";
export const RANGES = { "1H": 3_600_000, "24H": 86_400_000, "7D": 7 * 86_400_000, "30D": 30 * 86_400_000, ALL: 0 } as const;
export type Range = keyof typeof RANGES;
export interface GameOption { id: string; name: string; valueLabel: string; sources: { id: string; name: string }[] }
/** Only games and sources that exist and hold at least one observation are offered. */
export async function listGames(): Promise<GameOption[]> {
  const db = supabaseAdmin(), [{ data: games }, { data: sources }] = await Promise.all([db.from("games").select("id,name,value_label").eq("active", true), db.from("game_sources").select("id,name,game_id").eq("active", true)]);
  const out: GameOption[] = [];
  for (const g of games ?? []) { const s = (sources ?? []).filter(x => x.game_id === g.id), live: { id: string; name: string }[] = [];
    for (const src of s) { const { count } = await db.from("game_observations").select("id", { count: "exact", head: true }).eq("game_id", g.id).eq("source_id", src.id); if ((count ?? 0) > 0) live.push({ id: src.id, name: src.name }); }
    if (live.length) out.push({ id: g.id, name: g.name, valueLabel: g.value_label, sources: live }); }
  return out;
}
/** Oldest first, capped, so the analysis always sees a time ordered series. */
export async function loadSeries(gameId: string, sourceId: string, range: Range, cap = 20_000) {
  const db = supabaseAdmin(); let q = db.from("game_observations").select("value,observed_at,data_quality").eq("game_id", gameId).eq("source_id", sourceId).order("observed_at", { ascending: false }).limit(cap);
  if (RANGES[range]) q = q.gte("observed_at", new Date(Date.now() - RANGES[range]).toISOString());
  const { data, error } = await q; if (error) throw new Error("Could not read observations"); const rows = (data ?? []).reverse();
  const { data: h } = await db.from("collection_health").select("last_success_at,last_error_at").eq("source_id", sourceId).maybeSingle();
  return { values: rows.map(r => r.value as number), times: rows.map(r => r.observed_at as string), partial: rows.filter(r => r.data_quality === "partial").length, lastObservedAt: rows.length ? (rows[rows.length - 1].observed_at as string) : null, health: h ?? null };
}
/** Data is called delayed when the newest observation is older than the allowed gap. */
export const isDelayed = (lastIso: string | null, maxMin = 15) => !lastIso || Date.now() - Date.parse(lastIso) > maxMin * 60_000;
