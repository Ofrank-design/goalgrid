import { NextResponse } from "next/server";
import { LABELS, NOTICE, matchBody, proGate, resolveMatchup, store, acquireSimulationSlot, releaseSimulationSlot } from "@/lib/simulation/server";
import { simulateMatch } from "@/lib/simulation/match";
import { LIMIT_MESSAGE, allow } from "@/lib/security/limits";
export const maxDuration = 30;
/** POST /api/simulation/match. Runs one synthetic match on the server, stores it with its seed and versions, and returns the full event timeline. */
export async function POST(req: Request) {
  const g = await proGate(); if (g instanceof NextResponse) return g; const b = matchBody.safeParse(await req.json().catch(() => null)); if (!b.success) return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  if (!(await allow(g.id, "simulate"))) return NextResponse.json({ error: LIMIT_MESSAGE }, { status: 429 });
  const slot = await acquireSimulationSlot(g.id, "match"); if (!slot.slotId) return NextResponse.json({ error: slot.error ?? "Simulation capacity is busy." }, { status: 429 });
  try { const m = await resolveMatchup(b.data); if ("error" in m) return NextResponse.json({ error: m.error }, { status: 400 });
    const sim = simulateMatch(m.matrix, m.xg, m.seed), id = await store(g.id, { kind: "match", league: b.data.league, configuration: { home: b.data.home, away: b.data.away, scenario: b.data.scenario, homeAttack: b.data.homeAttack ?? null, awayAttack: b.data.awayAttack ?? null, applied: m.applied }, seed: m.seed, result: { final: sim.final, stats: sim.stats, baseline: m.baseline, scenario: m.scenario }, events: sim.events });
    return NextResponse.json({ id, labels: LABELS, notice: NOTICE, match: { league: b.data.league, home: b.data.home, away: b.data.away }, baseline: m.baseline, scenario: m.scenario, applied: m.applied, ...sim });
  } catch { return NextResponse.json({ error: "The simulation is temporarily unavailable" }, { status: 503 }); } finally { await releaseSimulationSlot(slot.slotId); }
}
