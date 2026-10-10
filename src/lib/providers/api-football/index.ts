import "server-only";
import { cached } from "@/lib/cache";
import { env } from "@/lib/env";
import { acquire } from "../limiter";
import { spendCredits } from "../budget";
import { providerFetch } from "../http";
import { ProviderError, type ProviderAdapter } from "../types";
import { leagueEntry } from "../../football/league-registry";
import type { HistMatch } from "../../../types/prediction";
import { normalizeApiFootball, normalizeApiFootballHistory, type AfFixture } from "./normalize";

const BASE = "https://v3.football.api-sports.io";
type AfBody = { response?: AfFixture[]; errors?: unknown; results?: number };

/** API-Football can answer 200 and still refuse: the reason is in `errors` (plan limit, bad key, season not allowed). */
function readBody(json: AfBody): AfFixture[] {
  const e = json.errors;
  const reasons = Array.isArray(e) ? e.map(String) : e && typeof e === "object" ? Object.values(e).map(String) : [];
  if (reasons.length) throw new ProviderError("api-football", /token|key|subscription|access/i.test(reasons.join(" ")) ? "auth" : "bad_response", `API-Football: ${reasons.join("; ").slice(0, 160)}`);
  if (!Array.isArray(json.response)) throw new ProviderError("api-football", "bad_response", "Unexpected response shape");
  return json.response;
}

async function call(path: string, timeoutMs = 10_000) {
  const key = env().API_FOOTBALL_KEY; if (!key) throw new ProviderError("api-football", "auth", "Not configured");
  await spendCredits("api-football"); await acquire("api-football");
  return providerFetch<AfBody>({ provider: "api-football", url: `${BASE}${path}`, headers: { "x-apisports-key": key }, timeoutMs });
}

/**
 * One request returns every competition playing that day, and the registry picks out the ones we track. The plan is small
 * (about 100 requests a day), so each date is kept for 20 minutes and the daily budget guard stops runaway use.
 */
export const apiFootball: ProviderAdapter<import("../../../types/football").Match[], { date: string }> & { configured(): boolean } = {
  id: "api-football",
  configured: () => Boolean(env().API_FOOTBALL_KEY),
  async fetch({ date }) {
    const t0 = Date.now();
    const { value } = await cached(`api-football:fixtures:${date}`, 20 * 60_000, 6 * 3_600_000, async () => readBody((await call(`/fixtures?date=${date}`)).json));
    return { data: normalizeApiFootball(value), meta: { provider: "api-football", fetchedAt: new Date().toISOString(), cached: false, latencyMs: Date.now() - t0 } };
  },
  async health() { try { await this.fetch({ date: new Date().toISOString().slice(0, 10) }); return { ok: true }; } catch (e) { return { ok: false, detail: (e as Error).message }; } },
};

/** A whole season of finished results for one competition. Free plans may refuse recent seasons; the error says so. */
export async function fetchApiFootballSeason(slug: string, season: number): Promise<HistMatch[]> {
  const id = leagueEntry(slug)?.af; if (!id) return [];
  const { json } = await call(`/fixtures?league=${id}&season=${season}&status=FT-AET-PEN`, 20_000);
  return normalizeApiFootballHistory(readBody(json));
}

