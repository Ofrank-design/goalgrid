import "server-only";
import { z, type ZodType } from "zod";
import type { OddsEvent } from "@/types/context";
import type { FdMatch } from "./football-data/normalize";
import type { SmFixture } from "./sportmonks/normalize";

/** Only the fields our adapters actually read. passthrough keeps the rest untouched, so a provider adding fields never breaks us. */
const nullableNum = z.number().nullable();
export const fdMatchSchema = z.object({
  id: z.number(), utcDate: z.string(), status: z.string(),
  homeTeam: z.object({ id: z.number(), name: z.string() }).passthrough(), awayTeam: z.object({ id: z.number(), name: z.string() }).passthrough(),
  competition: z.object({ code: z.string() }).passthrough(),
  score: z.object({ fullTime: z.object({ home: nullableNum.optional(), away: nullableNum.optional() }).passthrough().optional() }).passthrough().optional(),
}).passthrough() as unknown as ZodType<FdMatch>;

export const smFixtureSchema = z.object({
  id: z.number(), league_id: z.number(), starting_at: z.string(),
  participants: z.array(z.object({ id: z.number(), name: z.string() }).passthrough()).optional(),
}).passthrough() as unknown as ZodType<SmFixture>;

export const oddsEventSchema = z.object({
  id: z.string(), commence_time: z.string(), home_team: z.string(), away_team: z.string(),
  bookmakers: z.array(z.object({ key: z.string(), markets: z.array(z.object({ key: z.string(), outcomes: z.array(z.object({ name: z.string(), price: z.number() }).passthrough()) }).passthrough()) }).passthrough()),
}).passthrough() as unknown as ZodType<OddsEvent>;
