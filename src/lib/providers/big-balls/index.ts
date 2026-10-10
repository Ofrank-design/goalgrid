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
import { dataOf } from "../resolve";
import { normalizeBigBalls, readElo, readForm, toRating, type BbMatch } from "./normalize";
import { z, type ZodType } from "zod";
import type { LeagueSlug, Match } from "../../../types/football";
import type { TeamRating } from "../../../types/signals";

const BASE = "https://api.bigballsdata.com";
const MIN = 60_000, H = 3_600_000;
const bbMatchSchema = z.object({ id: z.string(), kickoff_utc: z.string(), status: z.string(),
  home: z.object({ id: z.string(), name: z.string() }).passthrough(), away: z.object({ id: z.string(), name: z.string() }).passthrough() }).passthrough() as unknown as ZodType<BbMatch>;

async function call(path: string, params: Record<string, string> = {}): Promise<unknown> {
  const k = env().BIG_BALLS_API_KEY; if (!k) throw new ProviderError("big-balls", "auth", "Not configured");
  await spendCredits("big-balls"); await acquire("big-balls");
  const qs = new URLSearchParams(params).toString();
  return (await providerFetch<unknown>({ provider: "big-balls", url: `${BASE}${path}${qs ? `?${qs}` : ""}`, headers: { Authorization: `Bearer ${k}` }, timeoutMs: 10_000 })).json;
}
const none = (e: unknown) => e instanceof ProviderError && e.status === 404;

async function dayMatches(slug: LeagueSlug, date: string): Promise<Match[]> {
  const code = leagueEntry(slug)?.bb; if (!code) return [];
  const { value } = await cached(`bb:matches:${slug}:${date}`, 20 * MIN, 3 * H, async () => {
    const d = dataOf(await call("/v1/matches", { sport: "football", league: code, date, limit: "100" }));
    if (!Array.isArray(d)) throw new ProviderError("big-balls", "bad_response", "Unexpected response shape"); return validateItems("big-balls", d, bbMatchSchema);
  });
  return normalizeBigBalls(value, slug);
}
const SLUGS = LEAGUE_REGISTRY.flatMap(l => ("bb" in l ? [l.slug as LeagueSlug] : []));

/** Fixtures in one unified schema for the five big leagues. Works alone. */
export const bigBalls: ProviderAdapter<Match[], { date: string; leagues?: readonly string[] }> & { configured(): boolean } = {
  id: "big-balls",
  configured: () => Boolean(env().BIG_BALLS_API_KEY),
  async fetch({ date, leagues }) {
    const t0 = Date.now(), want = SLUGS.filter(s => !leagues || leagues.includes(s));
    if (!want.length) return { data: [], meta: { provider: "big-balls", fetchedAt: new Date().toISOString(), cached: false, latencyMs: 0 } };
    const r = await Promise.allSettled(want.map(s => dayMatches(s, date)));
    if (r.every(x => x.status === "rejected")) throw (r[0] as PromiseRejectedResult).reason;
    return { data: r.flatMap(x => (x.status === "fulfilled" ? x.value : [])), meta: { provider: "big-balls", fetchedAt: new Date().toISOString(), cached: false, latencyMs: Date.now() - t0 } };
  },
  async health() { try { const r = await fetch(`${BASE}/v1/sports`); return { ok: r.ok }; } catch (e) { return { ok: false, detail: (e as Error).message }; } },
};

/** This fixture as Big Balls holds it. Its team ids are its own, so a match from another provider is found by teams and day. */
export async function findBigBallsMatch(m: Match): Promise<Match | null> {
  if (m.id.startsWith("bb:")) return m;
  return (await dayMatches(m.league.slug, m.kickoffUtc.slice(0, 10))).find(x => sameTeam(x.home.slug, m.home.slug) && sameTeam(x.away.slug, m.away.slug)) ?? null;
}
async function rating(teamId: string): Promise<TeamRating | null> {
  const [elo, team] = await Promise.allSettled([call(`/v1/teams/${teamId}/elo`, { sport: "football" }), call(`/v1/teams/${teamId}`, { sport: "football" })]);
  for (const r of [elo, team]) if (r.status === "rejected" && !none(r.reason)) throw r.reason;
  return toRating(elo.status === "fulfilled" ? readElo(dataOf(elo.value)) : { elo: null, leagueRank: null }, team.status === "fulfilled" ? readForm(dataOf(team.value)) : null);
}

/**
 * Elo ratings and recent form for both sides. The spec's single "context" endpoint does not exist on Big Balls, so this is assembled
 * from the documented per-team endpoints. Big Balls does not publish soccer injuries or lineups yet, so it supplies neither.
 */
export async function fetchBigBallsContext(m: Match): Promise<{ home: TeamRating | null; away: TeamRating | null } | null> {
  const bb = await findBigBallsMatch(m); if (!bb) return null;
  const one = (id: string) => cached(`bb:rating:${id}`, 6 * H, 24 * H, () => rating(id)).then(r => r.value);
  const [home, away] = await Promise.all([one(bb.home.providerId), one(bb.away.providerId)]);
  return { home, away };
}