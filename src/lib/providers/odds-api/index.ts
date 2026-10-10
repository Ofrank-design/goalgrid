import "server-only";
import { env } from "@/lib/env";
import { acquire } from "../limiter";
import { spendCredits } from "../budget";
import { validateItems } from "../validate";
import { oddsEventSchema } from "../schemas";
import { providerFetch } from "../http";
import { ProviderError, type ProviderAdapter } from "../types";
import type { OddsEvent } from "@/types/context";
import type { LeagueSlug } from "@/types/football";
import { LEAGUE_REGISTRY } from "../../football/league-registry";
/** The Odds API sport keys, from the league registry. A competition without one simply has no market signal. */
const SPORT: Partial<Record<LeagueSlug, string>> = Object.fromEntries(LEAGUE_REGISTRY.flatMap((l) => ("odds" in l ? [[l.slug, l.odds]] : [])));
/** The free plan has 500 credits a month. One call costs markets x regions = 2 credits, so a daily budget guard protects the month. */
const COST = 2;
export const oddsApi: ProviderAdapter<OddsEvent[], { league: LeagueSlug }> & { configured(): boolean } = {
  id: "odds-api",
  configured: () => Boolean(env().THE_ODDS_API_KEY),
  async fetch({ league }) {
    const key = env().THE_ODDS_API_KEY; if (!key) throw new ProviderError("odds-api", "auth", "Not configured");
    const sport = SPORT[league]; if (!sport) throw new ProviderError("odds-api", "bad_response", "No odds market is mapped for this competition");
    await spendCredits("odds-api", COST); await acquire("odds-api");
    const url = `https://api.the-odds-api.com/v4/sports/${sport}/odds?regions=uk&markets=h2h,totals&oddsFormat=decimal&dateFormat=iso&apiKey=${encodeURIComponent(key)}`;
    const { json, latencyMs } = await providerFetch<OddsEvent[]>({ provider: "odds-api", url });
    if (!Array.isArray(json)) throw new ProviderError("odds-api", "bad_response", "Unexpected response shape");
    return { data: validateItems("odds-api", json, oddsEventSchema), meta: { provider: "odds-api", fetchedAt: new Date().toISOString(), cached: false, latencyMs } };
  },
  async health() { return { ok: this.configured() }; },
};
