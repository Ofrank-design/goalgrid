import "server-only";
import { env } from "@/lib/env";
import { cached } from "@/lib/cache";
import { acquire } from "../limiter";
import { providerFetch } from "../http";
import { ProviderError, type ProviderAdapter } from "../types";
import type { OddsEvent } from "@/types/context";
import type { LeagueSlug } from "@/types/football";
import { LEAGUE_REGISTRY } from "../../football/league-registry";
import { normalizeOddsPapi, type OpFixture } from "./normalize";
const BASE = "https://api.oddspapi.io/v4", SOCCER = 10;
/** OddsPapi tournament ids. Premier League 17 is confirmed in their docs; the others follow the same numbering and should be confirmed with GET /v4/tournaments. */
const TOURNAMENT: Partial<Record<LeagueSlug, number>> = Object.fromEntries(LEAGUE_REGISTRY.flatMap((l) => ("op" in l ? [[l.slug, l.op]] : [])));
const key = () => { const k = env().ODDSPAPI_API_KEY; if (!k) throw new ProviderError("oddspapi", "auth", "Not configured"); return k; };
const names = () => cached("oddspapi:participants", 7 * 24 * 3_600_000, 14 * 24 * 3_600_000, async () => {
  await acquire("oddspapi"); return (await providerFetch<Record<string, string>>({ provider: "oddspapi", url: `${BASE}/participants?sportId=${SOCCER}&apiKey=${encodeURIComponent(key())}`, timeoutMs: 15_000 })).json; }).then(r => r.value);
/** One call returns every fixture and its odds for a tournament. The free plan allows 250 requests, so results are cached for hours by the caller. */
export const oddsPapi: ProviderAdapter<OddsEvent[], { league: LeagueSlug }> & { configured(): boolean } = {
  id: "oddspapi",
  configured: () => Boolean(env().ODDSPAPI_API_KEY),
  async fetch({ league }) {
    const tournament = TOURNAMENT[league]; if (!tournament) throw new ProviderError("oddspapi", "bad_response", "No odds tournament is mapped for this competition");
    const k = key(), book = process.env.ODDSPAPI_BOOKMAKERS ?? "pinnacle", map = await names(); await acquire("oddspapi");
    const { json, latencyMs } = await providerFetch<OpFixture[] | { data?: OpFixture[] }>({ provider: "oddspapi", url: `${BASE}/odds-by-tournaments?tournamentIds=${tournament}&bookmakers=${encodeURIComponent(book)}&apiKey=${encodeURIComponent(k)}`, timeoutMs: 20_000 });
    const list = Array.isArray(json) ? json : json.data; if (!Array.isArray(list)) throw new ProviderError("oddspapi", "bad_response", "Unexpected response shape");
    return { data: normalizeOddsPapi(list, map), meta: { provider: "oddspapi", fetchedAt: new Date().toISOString(), cached: false, latencyMs } };
  },
  async health() { return { ok: this.configured() }; },
};
