import "server-only";
import { env } from "@/lib/env";
import { acquire } from "../limiter";
import { spendCredits } from "../budget";
import { validateItems } from "../validate";
import { smFixtureSchema } from "../schemas";
import { providerFetch } from "../http";
import { ProviderError, type ProviderAdapter } from "../types";
import { SM_LEAGUES, normalizeSportmonks, type SmFixture } from "./normalize";
const BASE = "https://api.sportmonks.com/v3/football";
/** Primary football-data source. Keep the token in the Authorization header so it never appears in request URLs. */
export const sportmonks: ProviderAdapter<import("../../../types/football").Match[], { date: string }> & { configured(): boolean } = {
  id: "sportmonks",
  configured: () => Boolean(env().SPORTMONKS_API_KEY),
  async fetch({ date }) {
    const key = env().SPORTMONKS_API_KEY; if (!key) throw new ProviderError("sportmonks", "auth", "Not configured");
    await spendCredits("sportmonks"); await acquire("sportmonks");
    const url = `${BASE}/fixtures/date/${date}?include=participants;state;scores;round;venue&filters=fixtureLeagues:${Object.keys(SM_LEAGUES).join(",")}`;
    const { json, latencyMs } = await providerFetch<{ data?: SmFixture[] }>({ provider: "sportmonks", url, headers: { Authorization: key } });
    if (json.data !== undefined && !Array.isArray(json.data)) throw new ProviderError("sportmonks", "bad_response", "Unexpected response shape");
    return { data: normalizeSportmonks(validateItems("sportmonks", json.data ?? [], smFixtureSchema)), meta: { provider: "sportmonks", fetchedAt: new Date().toISOString(), cached: false, latencyMs } };
  },
  async health() { try { await this.fetch({ date: new Date().toISOString().slice(0, 10) }); return { ok: true }; } catch (e) { return { ok: false, detail: (e as Error).message }; } },
};
