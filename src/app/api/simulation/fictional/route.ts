import { z } from "zod";
import { generateLeague, playSeason } from "@/lib/simulation/fictional";
import { tool } from "@/lib/simulation/route";
const schema = z.object({ teams: z.number().int().min(6).max(24).default(16), goalRate: z.number().min(0.8).max(2.2).default(1.35), homeAdvantage: z.number().min(1).max(1.5).default(1.2), seed: z.string().optional() });
/** POST /api/simulation/fictional. Invented clubs, invented ratings, a full synthetic season. */
export const POST = (req: Request) => tool(req, schema, { addendum: true }, async (b, { seed }) => { const teams = generateLeague(b.teams, seed), s = playSeason(teams, seed, { goalRate: b.goalRate, homeAdvantage: b.homeAdvantage });
  return { kind: "fictional", configuration: b, count: s.matches.length, result: { table: s.table, teams }, body: { teams, table: s.table, matches: s.matches.slice(0, 40), totalMatches: s.matches.length, note: "Every club here is invented. Results are synthetic." } }; });
