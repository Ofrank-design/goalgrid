import "server-only";
import { z } from "zod";
const opt = z.string().min(1).optional();
const schema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
  SPORTMONKS_API_KEY: opt, FOOTBALL_DATA_API_KEY: opt, API_FOOTBALL_KEY: opt, STATS_PROVIDER_API_KEY: opt,
  THE_STATS_API_KEY: opt, GOAL_API_KEY: opt, BIG_BALLS_API_KEY: opt,
  ODDSPAPI_API_KEY: opt, THE_ODDS_API_KEY: opt, OPENWEATHER_API_KEY: opt, SERPAPI_API_KEY: opt, NEWS_API_KEY: opt,
  GROQ_API_KEY: opt, ANTHROPIC_API_KEY: opt, OPENROUTER_API_KEY: opt, GEMINI_API_KEY: opt, NVIDIA_API_KEY: opt,
  RESEND_API_KEY: opt, CRON_SECRET: opt,
});
let cached: z.infer<typeof schema> | undefined;
/** Validated on first use so a missing secret fails loudly on the server, never in the browser. */
export function env() { return (cached ??= schema.parse(process.env)); }
