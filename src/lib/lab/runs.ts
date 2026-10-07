import "server-only";
import { supabaseAdmin } from "@/lib/supabase/admin";
export const RUN_CAP_PER_USER = 50;
export interface RunRow { id: string; game_id: string; source_id: string; params: Record<string, unknown>; engine_version: string; observation_count: number; created_at: string }
/** Saves a run with the engine version that produced it. Old runs are never recomputed, so a result always shows what the engine said at the time. Keeps the newest 50 per user. */
export async function saveRun(userId: string, o: { gameId: string; sourceId: string; params: object; result: object; engineVersion: string; observations: number }): Promise<string> {
  const db = supabaseAdmin(), { data, error } = await db.from("analysis_runs").insert({ user_id: userId, game_id: o.gameId, source_id: o.sourceId, params: o.params, result: o.result, engine_version: o.engineVersion, observation_count: o.observations }).select("id").single();
  if (error || !data) throw new Error("Could not save the run");
  const { data: old } = await db.from("analysis_runs").select("id").eq("user_id", userId).order("created_at", { ascending: false }).range(RUN_CAP_PER_USER, RUN_CAP_PER_USER + 200); if (old?.length) await db.from("analysis_runs").delete().in("id", old.map(r => r.id as string));
  return data.id as string;
}
