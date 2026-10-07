import { z } from "zod";
import { FAMILIES, generateEvents, score, validateRule } from "@/lib/simulation/alerts";
import { tool } from "@/lib/simulation/route";
const schema = z.object({ minutes: z.number().int().min(60).max(1440).default(600), incidents: z.number().int().min(1).max(8).default(3), families: z.array(z.enum(FAMILIES)).max(7).optional(), rule: z.object({ family: z.enum(FAMILIES), minSeverity: z.number(), count: z.number().int(), withinMinutes: z.number() }), seed: z.string().optional() });
/** POST /api/simulation/alerts. Generates controlled synthetic events and checks an alert rule against the incidents that were injected. Rules are plain JSON conditions. */
export const POST = (req: Request) => tool(req, schema, { addendum: true }, async (b, { seed }) => { const bad = validateRule(b.rule); if (bad) return { error: bad }; const g = generateEvents(seed, { minutes: b.minutes, incidents: b.incidents, families: b.families?.length ? b.families : [b.rule.family] });
  return { body: { incidents: g.incidents, totalEvents: g.events.length, events: g.events.slice(0, 60), result: score(b.rule, g.events, g.incidents), note: "Synthetic events for testing alert logic. Nothing here is a real incident." } }; });
