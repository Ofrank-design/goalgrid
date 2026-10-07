import "server-only";
import { log } from "@/lib/logging/logger";
import { ENGINE_VERSION } from "@/lib/engine/versioning";
import { supabaseAdmin } from "@/lib/supabase/admin";
import type { Match } from "@/types/football";
import type { Prediction } from "@/types/prediction";
import { storedIsUsable } from "./freshness";

/** Best effort throughout: if the table is missing or unreachable, callers fall back to fitting models, exactly as before this cache existed. */
const predictionKey = (matchId: string) => `prediction:${matchId}`;
const leagueKey = (league: string, kind: "metrics" | "models") => `league:${league}:${kind}`;
type Row = { key: string; payload: unknown; engine_version: string; built_at: string };

export async function readStoredPredictions(matches: Match[], now = Date.now()): Promise<Map<string, Prediction>> {
  const out = new Map<string, Prediction>();
  if (!matches.length) return out;
  try {
    const db = supabaseAdmin(), byKey = new Map(matches.map(m => [predictionKey(m.id), m] as const)), keys = [...byKey.keys()];
    for (let i = 0; i < keys.length; i += 100) {
      const { data, error } = await db.from("engine_cache").select("key,payload,engine_version,built_at").in("key", keys.slice(i, i + 100));
      if (error) throw new Error(error.message);
      for (const r of (data ?? []) as Row[]) {
        const match = byKey.get(r.key);
        if (match && storedIsUsable({ engineVersion: r.engine_version, builtAt: r.built_at }, match, ENGINE_VERSION, now)) out.set(match.id, r.payload as Prediction);
      }
    }
  } catch (e) { log.warn("stored predictions unavailable", { message: (e as Error).message }); }
  return out;
}

/** Only matches that have not started are stored, so a stored prediction can never have been made with the result in the history. */
export async function writeStoredPredictions(entries: { match: Match; prediction: Prediction }[]): Promise<void> {
  const now = Date.now(), rows = entries.filter(e => e.match.status === "scheduled" && Date.parse(e.match.kickoffUtc) > now)
    .map(e => ({ key: predictionKey(e.match.id), payload: e.prediction, engine_version: ENGINE_VERSION, built_at: new Date(now).toISOString() }));
  if (!rows.length) return;
  try {
    for (let i = 0; i < rows.length; i += 50) {
      const { error } = await supabaseAdmin().from("engine_cache").upsert(rows.slice(i, i + 50), { onConflict: "key" });
      if (error) throw new Error(error.message);
    }
  } catch (e) { log.warn("could not store predictions", { message: (e as Error).message }); }
}

export async function readLeagueCache<T>(league: string, kind: "metrics" | "models", maxAgeMs: number, now = Date.now()): Promise<T | null> {
  try {
    const { data, error } = await supabaseAdmin().from("engine_cache").select("payload,engine_version,built_at").eq("key", leagueKey(league, kind)).maybeSingle();
    if (error) throw new Error(error.message);
    if (!data || data.engine_version !== ENGINE_VERSION || now - Date.parse(data.built_at as string) > maxAgeMs) return null;
    return data.payload as T;
  } catch (e) { log.warn("league cache unavailable", { league, kind, message: (e as Error).message }); return null; }
}

export async function writeLeagueCache(league: string, kind: "metrics" | "models", payload: unknown): Promise<void> {
  try {
    const { error } = await supabaseAdmin().from("engine_cache").upsert({ key: leagueKey(league, kind), payload, engine_version: ENGINE_VERSION, built_at: new Date().toISOString() }, { onConflict: "key" });
    if (error) throw new Error(error.message);
  } catch (e) { log.warn("could not store league cache", { league, kind, message: (e as Error).message }); }
}

/** Housekeeping: stored predictions for matches long past are never read again. */
export async function pruneEngineCache(olderThanDays = 30): Promise<void> {
  const { error } = await supabaseAdmin().from("engine_cache").delete().lt("built_at", new Date(Date.now() - olderThanDays * 86_400_000).toISOString()).like("key", "prediction:%");
  if (error) throw new Error(error.message);
}
