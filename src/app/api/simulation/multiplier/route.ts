import { z } from "zod";
import { MAX_ROUNDS, simulateMultiplier, validate } from "@/lib/simulation/multiplier";
import { tool } from "@/lib/simulation/route";
const schema = z.object({ family: z.enum(["exponential", "pareto", "lognormal"]), param: z.number(), instantStop: z.number().default(0.03), rounds: z.number().int().default(2000), hypotheticalTarget: z.number().optional(), virtualBalance: z.number().min(10).max(1e6).optional(), virtualUnit: z.number().min(0.01).max(1e5).optional(), seed: z.string().optional() });
/** POST /api/simulation/multiplier. A generic, fictional multiplier process for probability and variance study. It copies no real game, connects to no operator, and gives no staking or cash-out guidance. */
export const POST = (req: Request) => tool(req, schema, { addendum: true }, async (b, { seed }) => { const bad = validate({ ...b, rounds: b.rounds }); if (bad) return { error: bad }; const r = simulateMultiplier({ ...b, seed });
  return { kind: "multiplier", configuration: { ...b, seed }, count: b.rounds, result: { ...r, firstRounds: r.firstRounds.slice(0, 20) }, body: { ...r, maxRounds: MAX_ROUNDS, note: "A generic fictional process for studying probability and variance. It does not represent any real game, and it does not say when to stake or cash out." } }; });
