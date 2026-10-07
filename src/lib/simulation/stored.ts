import "server-only";
import { z } from "zod";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { deriveLive, deriveMomentum, type SimEvent, type MatchSim, type TeamStats } from "./match";
import { ENGINE_VERSION } from "./rng";
/** Loads one of the user's stored match runs and rebuilds everything the player needs from the stored events. Live chances and momentum are derived from those events, so replay shows exactly what was produced. */
export async function loadStoredMatch(userId: string, id: string) {
  if (!z.string().uuid().safeParse(id).success) return null;
  const { data: r } = await supabaseAdmin().from("simulation_runs").select("*").eq("id", id).eq("user_id", userId).eq("kind", "match").maybeSingle(); if (!r || !Array.isArray(r.events)) return null;
  const events = r.events as SimEvent[], res = r.result as { final: { home: number; away: number }; stats: { home: TeamStats; away: TeamStats }; baseline: Sum; scenario: Sum }, cfg = r.configuration as { home: string; away: string; applied?: { id: string; label: string; kind: string; mh: number; ma: number }[] };
  const xg = { home: res.scenario.xgHome, away: res.scenario.xgAway }, full = events.find(e => e.type === "full_time"), sim: MatchSim & { id: string; baseline: Sum; scenario: Sum; applied: NonNullable<typeof cfg.applied> } = { id: r.id as string, seed: r.seed as string, final: res.final, expectedGoals: xg, events, stats: res.stats, liveProbabilities: deriveLive(events, xg), momentum: deriveMomentum(events), addedTime: full ? Math.max(2, Math.round(full.t - 90)) : 3, baseline: res.baseline, scenario: res.scenario, applied: cfg.applied ?? [] };
  return { sim, league: r.league_slug as string, home: cfg.home, away: cfg.away, engineVersion: r.engine_version as string, currentEngine: ENGINE_VERSION };
}
interface Sum { home: number; draw: number; away: number; btts: number; over25: number; xgHome: number; xgAway: number }
