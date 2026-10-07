import "server-only";
import { log } from "@/lib/logging/logger";
import { NextResponse } from "next/server";
import { z } from "zod";
import { randomBytes } from "node:crypto";
import { getViewer } from "@/lib/app/session";
import { requireUser } from "@/lib/community/api";
import { hasTier } from "@/lib/entitlements";
import { leagueTeams, matchupBase } from "@/lib/engine/predictions";
import { PRESETS, resolveScenarios, summarize, tiltMatrix } from "@/lib/engine/scenarios";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { ENGINE_VERSION, MODEL_VERSION, validSeed } from "./rng";
import { GOALGRID_LIMITS, simulationLimits } from "@/lib/control";
export { ENGINE_VERSION, MODEL_VERSION };
export type RunKind = "match" | "multi" | "season" | "experiment" | "fictional" | "multiplier" | "risk" | "backtest";
export const LEAGUES = ["premier-league", "la-liga", "serie-a", "bundesliga", "ligue-1"] as const;
export const LABELS = ["SIMULATION", "SYNTHETIC DATA", "HYPOTHETICAL RESULT", "NOT A LIVE MATCH PREDICTION", "NOT VERIFIED PERFORMANCE"];
export const NOTICE = "A hypothetical result from a simulation. It is not a prediction of a real match and does not count toward any prediction record, leaderboard, trophy or challenge.";
export const LIMITS = { pro: { multi: GOALGRID_LIMITS.simulation.multiPro, season: GOALGRID_LIMITS.simulation.seasonPro }, premium: { multi: GOALGRID_LIMITS.simulation.multiPremium, season: GOALGRID_LIMITS.simulation.seasonPremium } } as const;
export const limitsForTier = simulationLimits;
export type SlotKind = "match" | "multi" | "season" | "experiment" | "compare";
export async function acquireSimulationSlot(userId: string, kind: SlotKind) {
  const db = supabaseAdmin();
  const { data, error } = await db.rpc("try_acquire_simulation_slot", { p_user_id: userId, p_kind: kind, p_max_slots: GOALGRID_LIMITS.simulation.maxConcurrentRuns, p_ttl_seconds: Math.ceil(GOALGRID_LIMITS.simulation.maxRuntimeMs / 1000) + 30 });
  if (error) { log.error("simulation slot rpc failed", { message: error.message }); return { slotId: null, error: "Simulation capacity is unavailable right now." }; }
  if (!data) return { slotId: null, error: "Too many simulations are already running for this account." };
  return { slotId: data as string, error: null };
}
export async function releaseSimulationSlot(slotId: string) {
  try { await supabaseAdmin().rpc("release_simulation_slot", { p_slot_id: slotId }); } catch {}
}
export const newSeed = () => randomBytes(4).toString("hex").toUpperCase();
export const matchBody = z.object({ league: z.enum(LEAGUES), home: z.string().regex(/^[a-z0-9-]{2,60}$/), away: z.string().regex(/^[a-z0-9-]{2,60}$/), scenario: z.array(z.string().max(40)).max(6).default([]), homeAttack: z.number().optional(), awayAttack: z.number().optional(), seed: z.string().optional() });
/** Pro and above only. The server generates every result: the browser can choose teams, scenarios and an optional starting seed, never the score, the probabilities or the seed after the run. */
export async function proGate(): Promise<NextResponse | { id: string; tier: "pro" | "premium" }> {
  const v = await getViewer(), u = await requireUser(); if (!u || !hasTier(v.tier, "pro")) return NextResponse.json({ error: "The Simulation Lab needs a free account. Sign in to use it." }, { status: 403 }); return { id: u.id, tier: hasTier(v.tier, "premium") ? "premium" : "pro" };
}
export async function resolveMatchup(b: z.infer<typeof matchBody>) {
  if (b.home === b.away) return { error: "Choose two different teams." }; if (b.seed != null && !validSeed(b.seed)) return { error: "A seed is 1 to 16 letters or numbers." };
  const teams = await leagueTeams(b.league); if (!teams.includes(b.home) || !teams.includes(b.away)) return { error: "Both teams must belong to the chosen league." };
  const base = await matchupBase(b.league, b.home, b.away); if (!base) return { error: "Not enough data to model this match." };
  const baseline = summarize(base.matrix), r = resolveScenarios(b.scenario, b.homeAttack != null || b.awayAttack != null ? { home: b.homeAttack, away: b.awayAttack } : null, baseline); if (!r.ok) return { error: r.error };
  const matrix = tiltMatrix(base.matrix, r.mh, r.ma), sc = summarize(matrix);
  return { matrix, xg: { home: sc.xgHome, away: sc.xgAway }, baseline, scenario: sc, applied: r.applied, seed: b.seed ?? newSeed() };
}
export async function store(userId: string, row: { kind: RunKind; league: string; configuration: object; seed: string; result: object; events?: object | null; count?: number }): Promise<string | null> {
  const { data } = await supabaseAdmin().from("simulation_runs").insert({ user_id: userId, kind: row.kind, league_slug: row.league, configuration: row.configuration, seed: row.seed, engine_version: ENGINE_VERSION, model_version: MODEL_VERSION, result: row.result, events: row.events ?? null, record_count: row.count ?? 1 }).select("id").single();
  const { data: old } = await supabaseAdmin().from("simulation_runs").select("id").eq("user_id", userId).order("created_at", { ascending: false }).range(100, 400); if (old?.length) await supabaseAdmin().from("simulation_runs").delete().in("id", old.map(o => o.id as string));
  return (data?.id as string | undefined) ?? null;
}
export const presetList = PRESETS.map(({ id, label, kind, note }) => ({ id, label, kind, note }));
export { leagueTeams };
