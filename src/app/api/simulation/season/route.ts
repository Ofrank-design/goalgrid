import { NextResponse } from "next/server";
import { z } from "zod";
import { seasonInputs } from "@/lib/engine/predictions";
import { LABELS, LEAGUES, LIMITS, NOTICE, newSeed, proGate, store, acquireSimulationSlot, releaseSimulationSlot } from "@/lib/simulation/server";
import { simulateSeasons } from "@/lib/simulation/season";
import { validSeed } from "@/lib/simulation/rng";
import { LIMIT_MESSAGE, allow } from "@/lib/security/limits";
import { GOALGRID_LIMITS } from "@/lib/control";
export const maxDuration = 60;
const body = z.object({ league: z.enum(LEAGUES), seasons: z.number().int().min(10).max(GOALGRID_LIMITS.simulation.maxIterations), seed: z.string().optional() });
/** POST /api/simulation/season. Monte Carlo over a hypothetical double round robin among the league's current teams, using the strength model. Not a forecast of the real table. */
export async function POST(req: Request) {
  const g = await proGate(); if (g instanceof NextResponse) return g; const b = body.safeParse(await req.json().catch(() => null)); if (!b.success || (b.data.seed != null && !validSeed(b.data.seed))) return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  if (b.data.seasons > LIMITS[g.tier].season) return NextResponse.json({ error: `Your plan allows up to ${LIMITS[g.tier].season.toLocaleString("en")} simulated seasons.` }, { status: 403 }); if (!(await allow(g.id, "simSeason"))) return NextResponse.json({ error: LIMIT_MESSAGE }, { status: 429 });
  const slot = await acquireSimulationSlot(g.id, "season"); if (!slot.slotId) return NextResponse.json({ error: slot.error ?? "Simulation capacity is busy." }, { status: 429 });
  try { const inp = await seasonInputs(b.data.league); if (!inp) return NextResponse.json({ error: "Not enough data to simulate this league." }, { status: 400 }); const seed = b.data.seed ?? newSeed(), r = simulateSeasons(inp, b.data.seasons, seed, { maxRuntimeMs: GOALGRID_LIMITS.simulation.maxRuntimeMs }); if (!r) return NextResponse.json({ error: "Not enough data to simulate this league." }, { status: 400 });
    const id = await store(g.id, { kind: "season", league: b.data.league, configuration: { seasons: b.data.seasons, teams: inp.teams.length }, seed, result: r, count: b.data.seasons });
    return NextResponse.json({ id, labels: LABELS, notice: NOTICE, league: b.data.league, ...r, note: "Synthetic seasons built from team strength ratings. Real injuries, transfers and schedules are not modelled." });
  } catch { return NextResponse.json({ error: "The simulation is temporarily unavailable" }, { status: 503 }); } finally { await releaseSimulationSlot(slot.slotId); }
}
