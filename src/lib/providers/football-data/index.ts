import "server-only";
import { env } from "@/lib/env";
import { acquire } from "../limiter";
import { validateItems } from "../validate";
import { fdMatchSchema } from "../schemas";
import { providerFetch } from "../http";
import { ProviderError, type ProviderAdapter } from "../types";
import { FD_COMPETITIONS, normalizeFootballData, normalizeHistory, type FdMatch } from "./normalize";
import type { LeagueSlug } from "../../../types/football";
import type { HistMatch } from "../../../types/prediction";
const BASE = "https://api.football-data.org/v4";
/** Secondary football-data source used for fallback and validation. */
export const footballData: ProviderAdapter<import("../../../types/football").Match[], { date: string }> & { configured(): boolean } = {
  id: "football-data",
  configured: () => Boolean(env().FOOTBALL_DATA_API_KEY),
  async fetch({ date }) {
    const key = env().FOOTBALL_DATA_API_KEY; if (!key) throw new ProviderError("football-data", "auth", "Not configured");
    await acquire("football-data");
    const url = `${BASE}/matches?dateFrom=${date}&dateTo=${date}&competitions=${Object.keys(FD_COMPETITIONS).join(",")}`;
    const { json, latencyMs } = await providerFetch<{ matches?: FdMatch[] }>({ provider: "football-data", url, headers: { "X-Auth-Token": key } });
    if (!Array.isArray(json.matches)) throw new ProviderError("football-data", "bad_response", "Unexpected response shape");
    return { data: normalizeFootballData(validateItems("football-data", json.matches, fdMatchSchema)), meta: { provider: "football-data", fetchedAt: new Date().toISOString(), cached: false, latencyMs } };
  },
  async health() { try { await this.fetch({ date: new Date().toISOString().slice(0, 10) }); return { ok: true }; } catch (e) { return { ok: false, detail: (e as Error).message }; } },
};

/** A whole season of finished results for one league, used to fit the models. */
export async function fetchSeasonResults(league: LeagueSlug, season: number): Promise<HistMatch[]> {
  const key = env().FOOTBALL_DATA_API_KEY; if (!key) throw new ProviderError("football-data", "auth", "Not configured");
  const code = Object.entries(FD_COMPETITIONS).find(([, v]) => v.slug === league)?.[0]; if (!code) return [];
  await acquire("football-data", 15_000);
  const { json } = await providerFetch<{ matches?: FdMatch[] }>({ provider: "football-data", url: `${BASE}/competitions/${code}/matches?season=${season}&status=FINISHED`, headers: { "X-Auth-Token": key }, timeoutMs: 15_000 });
  if (!Array.isArray(json.matches)) throw new ProviderError("football-data", "bad_response", "Unexpected response shape");
  return normalizeHistory(validateItems("football-data", json.matches, fdMatchSchema));
}
