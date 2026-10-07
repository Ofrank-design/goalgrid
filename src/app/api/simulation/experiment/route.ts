export const maxDuration = 60;
import { z } from "zod";
import { matchBody, resolveMatchup } from "@/lib/simulation/server";
import { runMany } from "@/lib/simulation/match";
import { tool } from "@/lib/simulation/route";
import { GOALGRID_LIMITS } from "@/lib/control";
const variant = z.object({ label: z.string().trim().min(1).max(40), scenario: z.array(z.string().max(40)).max(6).default([]), homeAttack: z.number().optional(), awayAttack: z.number().optional() });
const schema = matchBody.omit({ scenario: true, homeAttack: true, awayAttack: true }).extend({ name: z.string().trim().min(3).max(80).default("Untitled experiment"), dataset: z.enum(["current-league-history"]).default("current-league-history"), model: z.enum(["goalgrid-ensemble", "poisson-strength"]).default("goalgrid-ensemble"), runs: z.number().int().refine(n => [100, 1000].includes(n), "Choose 100 or 1,000 runs"), variants: z.array(variant).min(2).max(4) });
async function resolveExperimentMatchup(b: z.infer<typeof schema>, v: z.infer<typeof variant>, seed: string) {
  if (b.model === "goalgrid-ensemble") {
    return resolveMatchup({ league: b.league, home: b.home, away: b.away, scenario: v.scenario, seed });
  }
  const { seasonInputs } = await import("@/lib/engine/predictions");
  const { matrixFrom, poissonPmf } = await import("@/lib/engine/models/math");
  const { resolveScenarios, tiltMatrix, summarize } = await import("@/lib/engine/scenarios");
  const inputs = await seasonInputs(b.league); if (!inputs) return { error: "Not enough historical data for the Poisson strength baseline." };
  const rate = inputs.rates(b.home, b.away); if (!rate) return { error: "Teams cannot be priced from the current league history." };
  const baseMatrix = matrixFrom((x, y) => poissonPmf(x, rate.lh) * poissonPmf(y, rate.la));
  const base = summarize(baseMatrix);
  const scenario = resolveScenarios(v.scenario, null, base); if (!scenario.ok) return { error: scenario.error };
  const matrix = tiltMatrix(baseMatrix, scenario.mh, scenario.ma), sc = summarize(matrix);
  return { matrix, xg: { home: sc.xgHome, away: sc.xgAway }, baseline: base, scenario: sc, applied: scenario.applied, seed };
}
/** POST /api/simulation/experiment (Premium). Same seed for every variant, so differences come from the assumptions and not from luck. Total work is capped at 20,000 simulated matches. */
export const POST = (req: Request) => tool(req, schema, { premium: true, kind: "experiment" }, async (b, { seed }) => {
  if (b.runs * b.variants.length > 20000) return { error: "An experiment is limited to 20,000 simulated matches in total." }; const out = [];
  for (const v of b.variants) { const m = await resolveExperimentMatchup(b, v, seed); if ("error" in m) return { error: `${v.label}: ${m.error}` }; out.push({ label: v.label, applied: m.applied, xg: m.xg, model: m.scenario, sim: runMany(m.matrix, b.runs, seed, GOALGRID_LIMITS.simulation.maxRuntimeMs) }); }
  const base = out[0].sim, table = out.map(o => ({ label: o.label, applied: o.applied.map(a => a.label), home: o.sim.home.probability, draw: o.sim.draw.probability, away: o.sim.away.probability, btts: o.sim.btts.probability, over25: o.sim.over25.probability, margin: o.sim.home.margin, vsFirstPp: { home: Math.round((o.sim.home.probability - base.home.probability) * 1000) / 10, draw: Math.round((o.sim.draw.probability - base.draw.probability) * 1000) / 10, away: Math.round((o.sim.away.probability - base.away.probability) * 1000) / 10 } }));
  return { kind: "experiment", league: b.league, configuration: { name: b.name, dataset: b.dataset, model: b.model, home: b.home, away: b.away, runs: b.runs, variants: b.variants }, count: b.runs * b.variants.length, result: { table }, body: { table, note: "Every variant used the same seed, so differences reflect your assumptions. Differences smaller than the margin may just be sampling noise." } }; });
