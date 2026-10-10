import "server-only";
import { cached } from "@/lib/cache";
import { env } from "@/lib/env";
import { acquire } from "../limiter";
import { spendCredits } from "../budget";
import { providerFetch } from "../http";
import { ProviderError, type ProviderAdapter } from "../types";
import { LEAGUE_REGISTRY, leagueEntry } from "../../football/league-registry";
import { sameTeam } from "../../football/team-resolver";
import { dataOf, pickByName } from "../resolve";
import { normalizeGoalFixtures, readGoalForm, readGoalScorers, readGoalStats, type Scorer } from "./normalize";
import type { LeagueSlug, Match } from "../../../types/football";
import type { MatchStatLine } from "../../../types/signals";

const BASE = "https://api.goal-api.com/v1";
const MIN = 60_000, H = 3_600_000, D = 24 * H;

/** Football-service errors arrive as `{ success: false, code }`, sometimes with HTTP 200. Read both. */
function check(json: unknown) {
  const j = json as { success?: unknown; code?: unknown; error?: unknown; message?: unknown } | null;
  if (j && j.success === false) { const code = String(j.code ?? ""), text = String(j.error ?? j.message ?? code).slice(0, 160);
    throw new ProviderError("goal-api", code === "RATE_LIMIT_EXCEEDED" || code === "BURST_LIMIT_EXCEEDED" ? "rate_limited" : /AUTH|API_KEY|ACCESS_DENIED|PLAN_UPGRADE/.test(code) ? "auth" : "bad_response", `GOAL API: ${text}`); }
  return json;
}
async function call(path: string, params: Record<string, string> = {}): Promise<unknown> {
  const k = env().GOAL_API_KEY; if (!k) throw new ProviderError("goal-api", "auth", "Not configured");
  await spendCredits("goal-api"); await acquire("goal-api");
  const qs = new URLSearchParams(params).toString();
  return check((await providerFetch<unknown>({ provider: "goal-api", url: `${BASE}${path}${qs ? `?${qs}` : ""}`, headers: { Authorization: `Bearer ${k}` }, timeoutMs: 10_000 })).json);
}
const none = (e: unknown) => e instanceof ProviderError && e.status === 404;
const rows = (json: unknown): unknown[] => { const d = dataOf(json); return Array.isArray(d) ? d : []; };
const idOf = (r: unknown) => { const o = r as { id?: unknown } | null; return o && (typeof o.id === "string" || typeof o.id === "number") ? String(o.id) : null; };

/** League ids are internal, so each competition is found once by country and name and kept for a week ("Premier League" alone would also match Ghana's). */
async function leagueId(slug: LeagueSlug): Promise<string | null> {
  const e = leagueEntry(slug)?.ga; if (!e) return null;
  const { value } = await cached(`goal:league:${slug}`, 7 * D, 30 * D, async () => {
    const country = pickByName(rows(await call("/countries", { search: e.country, limit: "20" })) as { id?: unknown; name?: string }[], c => c.name, e.country), cid = idOf(country);
    if (!cid) throw new ProviderError("goal-api", "bad_response", `No country found for ${slug}`);
    const hit = pickByName(rows(await call("/leagues", { countryId: cid, isActive: "true", limit: "100" })) as { id?: unknown; name?: string }[], l => l.name, e.name), id = idOf(hit);
    if (!id) throw new ProviderError("goal-api", "bad_response", `No league found for ${slug}`); return id;
  });
  return value;
}
const SLUGS = LEAGUE_REGISTRY.flatMap(l => ("ga" in l ? [l.slug as LeagueSlug] : []));

/** Fixtures by date, one request per league. Used as a later fallback in the fixtures chain. */
export const goalApi: ProviderAdapter<Match[], { date: string }> & { configured(): boolean } = {
  id: "goal-api",
  configured: () => Boolean(env().GOAL_API_KEY),
  async fetch({ date }) {
    const t0 = Date.now();
    const r = await Promise.allSettled(SLUGS.map(async slug => { const id = await leagueId(slug); if (!id) return []; const { value } = await cached(`goal:fixtures:${slug}:${date}`, 20 * MIN, 3 * H, async () => rows(await call(`/fixtures/date/${date}`, { leagueId: id, limit: "100" }))); return normalizeGoalFixtures(value, slug); }));
    if (r.every(x => x.status === "rejected")) throw (r[0] as PromiseRejectedResult).reason;
    return { data: r.flatMap(x => (x.status === "fulfilled" ? x.value : [])), meta: { provider: "goal-api", fetchedAt: new Date().toISOString(), cached: false, latencyMs: Date.now() - t0 } };
  },
  async health() { try { const r = await fetch(`${BASE}/public/status`); return { ok: r.ok }; } catch (e) { return { ok: false, detail: (e as Error).message }; } },
};

/** Finds this fixture on GOAL API, whichever provider the match came from. Shares the per-day cache with the fixtures adapter. */
export async function findGoalMatch(m: Match): Promise<Match | null> {
  if (m.id.startsWith("ga:")) return m;
  const id = await leagueId(m.league.slug); if (!id) return null; const day = m.kickoffUtc.slice(0, 10);
  const { value } = await cached(`goal:fixtures:${m.league.slug}:${day}`, 20 * MIN, 3 * H, async () => rows(await call(`/fixtures/date/${day}`, { leagueId: id, limit: "100" })));
  return normalizeGoalFixtures(value, m.league.slug).find(x => sameTeam(x.home.slug, m.home.slug) && sameTeam(x.away.slug, m.away.slug)) ?? null;
}

/** Possession, shots, shots on target, pass accuracy and xG for a played fixture. null when the provider has none ("the match needs to have started"). */
export async function fetchGoalStats(matchId: string): Promise<MatchStatLine | null> {
  const id = matchId.replace(/^ga:/, "");
  try { const { value } = await cached(`goal:stats:${id}`, 6 * H, 24 * H, async () => dataOf(await call(`/fixtures/${id}/statistics`, { half: "full" }))); return readGoalStats(value, matchId); }
  catch (e) { if (none(e)) return null; throw e; }
}
/** Recent results by team for a league, as W/D/L strings keyed by team slug. */
export async function fetchGoalForm(slug: LeagueSlug): Promise<Map<string, string>> {
  const id = await leagueId(slug); if (!id) return new Map();
  try { const { value } = await cached(`goal:form:${slug}`, 3 * H, 12 * H, async () => rows(await call(`/standings/${id}/form`))); return readGoalForm(value); }
  catch (e) { if (none(e)) return new Map(); throw e; }
}
export async function fetchGoalTopScorers(slug: LeagueSlug, limit = 10): Promise<Scorer[]> {
  const id = await leagueId(slug); if (!id) return [];
  try { const { value } = await cached(`goal:scorers:${slug}:${limit}`, 3 * H, 12 * H, async () => rows(await call(`/leagues/${id}/top-scorers`, { limit: String(limit) }))); return readGoalScorers(value); }
  catch (e) { if (none(e)) return []; throw e; }
}
