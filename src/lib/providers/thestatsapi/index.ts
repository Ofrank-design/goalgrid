import "server-only";
import { cached } from "@/lib/cache";
import { env } from "@/lib/env";
import { acquire } from "../limiter";
import { spendCredits } from "../budget";
import { validateItems } from "../validate";
import { providerFetch } from "../http";
import { ProviderError, type ProviderAdapter } from "../types";
import { LEAGUE_REGISTRY, leagueEntry } from "../../football/league-registry";
import { sameTeam } from "../../football/team-resolver";
import { addDays, dataOf, pickByName } from "../resolve";
import { normalizeTsMatches, readTsStats, tsOddsToEvent, type TsMatch } from "./normalize";
import { z, type ZodType } from "zod";
import type { LeagueSlug, Match } from "../../../types/football";
import type { OddsEvent } from "../../../types/context";
import type { MatchStatLine, Unavailable } from "../../../types/signals";

const BASE = "https://api.thestatsapi.com/api";
/** Domestic slates have gaps (international breaks, midweek cups). Every fixtures query looks at least this far ahead so a page is never blank. */
export const LOOKAHEAD_DAYS = 3;
const MIN = 60_000, H = 3_600_000, D = 24 * H;

const tsMatchSchema = z.object({ id: z.string(), competition_id: z.string(), status: z.string(), utc_date: z.string(),
  home_team: z.object({ id: z.string(), name: z.string() }).passthrough(), away_team: z.object({ id: z.string(), name: z.string() }).passthrough() }).passthrough() as unknown as ZodType<TsMatch>;
const key = () => { const e = env(); return e.THE_STATS_API_KEY ?? e.STATS_PROVIDER_API_KEY; };

async function call<T>(path: string, params: Record<string, string> = {}): Promise<T> {
  const k = key(); if (!k) throw new ProviderError("thestatsapi", "auth", "Not configured");
  await spendCredits("thestatsapi"); await acquire("thestatsapi");
  const qs = new URLSearchParams(params).toString();
  return (await providerFetch<T>({ provider: "thestatsapi", url: `${BASE}${path}${qs ? `?${qs}` : ""}`, headers: { Authorization: `Bearer ${k}` }, timeoutMs: 10_000 })).json;
}
/** The provider answers 404 when it has no data for a match (never collected, no odds) and 409 for a live or finished mismatch. Those mean "none", not "broken". */
const none = (e: unknown) => e instanceof ProviderError && (e.status === 404 || e.status === 409);
const bare = (matchId: string) => matchId.replace(/^ts:/, "");

/** Competition ids are strings. One is pinned in the registry where known; the rest are found by country and name once, then kept for a week. */
async function competitionId(slug: LeagueSlug): Promise<string | null> {
  const e = leagueEntry(slug)?.ts; if (!e) return null; if (e.id) return e.id;
  const { value } = await cached(`tsa:competition:${slug}`, 7 * D, 30 * D, async () => {
    const j = await call<{ data?: { id: string; name: string }[] }>("/football/competitions", { country_code: e.cc, type: "league", per_page: "100" });
    const hit = pickByName(Array.isArray(j.data) ? j.data : [], c => c.name, e.name);
    if (!hit) throw new ProviderError("thestatsapi", "bad_response", `No competition found for ${slug}`); return hit.id;
  });
  return value;
}

async function windowMatches(slug: LeagueSlug, from: string, to: string): Promise<Match[]> {
  const id = await competitionId(slug); if (!id) return [];
  const { value } = await cached(`tsa:matches:${slug}:${from}:${to}`, 20 * MIN, 3 * H, async () => {
    const j = await call<{ data?: unknown }>("/football/matches", { competition_id: id, date_from: from, date_to: to, sort: "utc_date", per_page: "100" });
    if (!Array.isArray(j.data)) throw new ProviderError("thestatsapi", "bad_response", "Unexpected response shape");
    return validateItems("thestatsapi", j.data, tsMatchSchema);
  });
  return normalizeTsMatches(value, slug);
}

const SLUGS = LEAGUE_REGISTRY.flatMap(l => ("ts" in l ? [l.slug as LeagueSlug] : []));
async function allLeagues(from: string, days: number): Promise<Match[]> {
  const to = addDays(from, days), r = await Promise.allSettled(SLUGS.map(s => windowMatches(s, from, to)));
  if (r.every(x => x.status === "rejected")) throw (r[0] as PromiseRejectedResult).reason;
  return r.flatMap(x => (x.status === "fulfilled" ? x.value : []));
}

/** Fixtures layer: schedules and a rolling lookahead. Works alone; it needs no other provider. */
export const theStatsApi: ProviderAdapter<Match[], { date: string }> & { configured(): boolean; lookahead(from: string, days?: number): Promise<Match[]> } = {
  id: "thestatsapi",
  configured: () => Boolean(key()),
  async fetch({ date }) {
    const t0 = Date.now(), all = await allLeagues(date, LOOKAHEAD_DAYS);
    return { data: all.filter(m => m.kickoffUtc.slice(0, 10) === date), meta: { provider: "thestatsapi", fetchedAt: new Date().toISOString(), cached: false, latencyMs: Date.now() - t0 } };
  },
  /** Matches in the days after `from`, for when a day's own slate is empty. */
  async lookahead(from, days = LOOKAHEAD_DAYS) { return (await allLeagues(from, Math.max(days, LOOKAHEAD_DAYS))).filter(m => m.kickoffUtc.slice(0, 10) > from); },
  async health() { try { const r = await fetch(`${BASE}/health`); return { ok: r.ok }; } catch (e) { return { ok: false, detail: (e as Error).message }; } },
};

/** Post-match team statistics, fetched only when a result page asks for them. Possession, shots, passing and xG. null when the provider never collected them. */
export async function fetchTsMatchStats(matchId: string): Promise<MatchStatLine | null> {
  const id = bare(matchId);
  try { const { value } = await cached(`tsa:stats:${id}`, 6 * H, 24 * H, async () => dataOf(await call<unknown>(`/football/matches/${id}/stats`))); return readTsStats(value, matchId); }
  catch (e) { if (none(e)) return null; throw e; }
}

/** Players ruled out right now. Counts only: the shift this feeds is deliberately coarse. */
export async function fetchTsUnavailable(teamId: string): Promise<Unavailable | null> {
  try {
    const { value } = await cached(`tsa:unavailable:${teamId}`, H, 6 * H, async () => dataOf(await call<unknown>(`/football/teams/${teamId}/injuries-suspensions`)));
    const d = value as { injuries?: unknown; suspensions?: unknown } | null; if (!d || typeof d !== "object") return null;
    return { injuries: Array.isArray(d.injuries) ? d.injuries.length : 0, suspensions: Array.isArray(d.suspensions) ? d.suspensions.length : 0 };
  } catch (e) { if (none(e)) return null; throw e; }
}

/** Predicted XI before the team sheet is out, the official one after. Only a team sheet counts as confirmed. */
export async function fetchTsLineupsConfirmed(matchId: string): Promise<boolean | null> {
  try { const d = dataOf(await call<unknown>(`/football/matches/${bare(matchId)}/lineups`)) as { confirmed?: unknown } | null; return typeof d?.confirmed === "boolean" ? d.confirmed : null; }
  catch (e) { if (none(e)) return null; throw e; }
}

/** Finds this fixture on TheStatsAPI, whichever provider the match came from. */
export async function findTsMatch(m: Match): Promise<Match | null> {
  if (m.id.startsWith("ts:")) return m;
  const day = m.kickoffUtc.slice(0, 10), list = await windowMatches(m.league.slug, day, day);
  return list.find(x => sameTeam(x.home.slug, m.home.slug) && sameTeam(x.away.slug, m.away.slug)) ?? null;
}

/** Bookmaker prices as an OddsEvent. The caller removes the margin with the same code it uses for every other odds source. */
export async function fetchTsOdds(m: Match): Promise<OddsEvent | null> {
  const ts = await findTsMatch(m); if (!ts) return null;
  try { const d = dataOf(await call<unknown>(`/football/matches/${bare(ts.id)}/odds`)) as { bookmakers?: unknown } | null; return Array.isArray(d?.bookmakers) ? tsOddsToEvent(d.bookmakers as never, m) : null; }
  catch (e) { if (none(e)) return null; throw e; }
}
