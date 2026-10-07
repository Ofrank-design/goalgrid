import { z } from "zod";
import { FIELDS, OUTCOMES, backtest, syntheticObservations, validateRule } from "@/lib/simulation/backtest";
import { tool } from "@/lib/simulation/route";
const schema = z.object({ rule: z.object({ conditions: z.array(z.object({ field: z.enum(FIELDS), op: z.enum([">=", "<="]), value: z.number() })).min(1).max(4), outcome: z.enum(OUTCOMES) }), teams: z.number().int().min(8).max(20).default(16), seasons: z.number().int().min(2).max(20).default(8), seed: z.string().optional() });
/** POST /api/simulation/backtest. A constrained rule is checked against synthetic seasons. Rules are data, never code. */
export const POST = (req: Request) => tool(req, schema, { action: "simSeason" , addendum: true }, async (b, { seed }) => { const bad = validateRule(b.rule); if (bad) return { error: bad }; const obs = syntheticObservations(seed, b.teams, b.seasons), r = backtest(obs, b.rule);
  return { kind: "backtest", configuration: b, count: obs.length, result: r, body: { ...r, dataScope: "synthetic", rule: b.rule } }; });
