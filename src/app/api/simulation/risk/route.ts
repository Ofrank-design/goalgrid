import { z } from "zod";
import { runRisk, sensitivity, validate, type RiskConfig } from "@/lib/simulation/bankroll";
import { tool } from "@/lib/simulation/route";
const schema = z.object({ probability: z.number(), odds: z.number(), mode: z.enum(["fixed", "percent", "kelly"]), unit: z.number().default(10), percent: z.number().optional(), kellyFraction: z.number().optional(), startBalance: z.number().default(1000), bets: z.number().int().default(100), paths: z.number().int().default(500), seed: z.string().optional() });
/** POST /api/simulation/risk. Variance and drawdown education with a virtual balance and numbers the user supplies. There is no default edge, and the answer never recommends a real stake. */
export const POST = (req: Request) => tool(req, schema, { addendum: true }, async (b, { seed }) => { const c: RiskConfig = { ...b, seed }, bad = validate(c); if (bad) return { error: bad }; const r = runRisk(c), s = sensitivity(c);
  return { kind: "risk", configuration: c, count: c.paths, result: { ...r, samplePaths: [] }, body: { ...r, sensitivity: s, note: "Hypothetical and educational. The probability is your own assumption and may be wrong; the sensitivity table shows how much a wrong estimate changes the outcome. This is not advice on what to stake." } }; });
