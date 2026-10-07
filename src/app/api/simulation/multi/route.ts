import { NextResponse } from "next/server";
import { z } from "zod";
import { LABELS, LIMITS, NOTICE, matchBody, proGate, resolveMatchup, store, acquireSimulationSlot, releaseSimulationSlot } from "@/lib/simulation/server";
import { runMany } from "@/lib/simulation/match";
import { LIMIT_MESSAGE, allow } from "@/lib/security/limits";
import { GOALGRID_LIMITS } from "@/lib/control";
export const maxDuration = 30;
const body = matchBody.extend({ runs: z.number().int().refine(n => [10, 100, 1000].includes(n), "Choose 10, 100 or 1,000 runs") });
/** POST /api/simulation/multi. Repeats the match many times. Every account can run up to 1,000 runs. Each result carries its own sampling error. */
export async function POST(req: Request) {
  const g = await proGate(); if (g instanceof NextResponse) return g; const b = body.safeParse(await req.json().catch(() => null)); if (!b.success) return NextResponse.json({ error: b.error.issues[0]?.message ?? "Invalid request" }, { status: 400 });
  if (b.data.runs > LIMITS[g.tier].multi) return NextResponse.json({ error: `Your plan allows up to ${LIMITS[g.tier].multi.toLocaleString("en")} runs.` }, { status: 403 }); if (!(await allow(g.id, "simulate"))) return NextResponse.json({ error: LIMIT_MESSAGE }, { status: 429 });
  const slot = await acquireSimulationSlot(g.id, "multi"); if (!slot.slotId) return NextResponse.json({ error: slot.error ?? "Simulation capacity is busy." }, { status: 429 });
  try { const m = await resolveMatchup(b.data); if ("error" in m) return NextResponse.json({ error: m.error }, { status: 400 }); const r = runMany(m.matrix, b.data.runs, m.seed, GOALGRID_LIMITS.simulation.maxRuntimeMs);
    const id = await store(g.id, { kind: "multi", league: b.data.league, configuration: { home: b.data.home, away: b.data.away, scenario: b.data.scenario, applied: m.applied, runs: b.data.runs }, seed: m.seed, result: r, count: b.data.runs });
    return NextResponse.json({ id, labels: LABELS, notice: NOTICE, baseline: m.baseline, scenario: m.scenario, applied: m.applied, ...r, note: "Counts converge on the model's probabilities as runs increase. The margin is the 95% sampling error of the count, not the model's own uncertainty." });
  } catch { return NextResponse.json({ error: "The simulation is temporarily unavailable" }, { status: 503 }); } finally { await releaseSimulationSlot(slot.slotId); }
}
