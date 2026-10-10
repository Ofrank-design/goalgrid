import "server-only";

import { cached } from "@/lib/cache";
import { validateMatch } from "@/lib/engine/validation/match";
import { log } from "@/lib/logging/logger";
import { footballData } from "@/lib/providers/football-data";
import { recordHealth } from "@/lib/providers/health";
import { ProviderError, type ProviderId } from "@/lib/providers/types";
import { sportmonks } from "@/lib/providers/sportmonks";
import { apiFootball } from "@/lib/providers/api-football";
import { bigBalls } from "@/lib/providers/big-balls";
import { theStatsApi } from "@/lib/providers/thestatsapi";
import { goalApi } from "@/lib/providers/goal-api";
import { sameTeam } from "@/lib/football/team-resolver";
import { LEAGUE_REGISTRY } from "@/lib/football/league-registry";
import { selectProviders } from "./fixture-plan";
import type { Match, Source } from "@/types/football";

interface FixtureProvider { id: ProviderId; configured(): boolean; fetch(q: { date: string; leagues?: readonly string[] }): Promise<{ data: Match[]; meta: { latencyMs: number } }> }

/**
 * The priority route. Within a tier the providers run side by side; a later tier is asked only when an earlier one came back empty or
 * failed, or when it covers a competition that has no matches yet (see selectProviders). Later tiers are only asked for the leagues still missing. When two providers list the same match, the earlier one's record is kept.
 */
const TIERS: FixtureProvider[][] = [[footballData, sportmonks], [bigBalls, theStatsApi], [apiFootball, goalApi]];

export interface FixturesResult {
  matches: Match[];
  source: Source | null;
  stale: boolean;
  attempts: {
    provider: string;
    ok: boolean;
    count?: number;
    error?: string;
    skipped?: boolean;
  }[];
  /** Matches in the next few days, filled only when the requested day has none (international break, midweek gap) so a page is never blank. */
  lookahead?: Match[];
}

/** The same fixture from two providers: same competition, same two teams, same day. */
const sameFixture = (a: Match, b: Match) => a.league.slug === b.league.slug && a.kickoffUtc.slice(0, 10) === b.kickoffUtc.slice(0, 10) && sameTeam(a.home.slug, b.home.slug) && sameTeam(a.away.slug, b.away.slug);

async function loadFixtures(
  date: string,
): Promise<Omit<FixturesResult, "stale">> {
  const all = TIERS.flat();
  const attempts: FixturesResult["attempts"] = all.filter((p) => !p.configured()).map((p) => ({ provider: p.id, ok: false, error: "not configured" }));
  const answered: FixtureProvider[] = [], matches: Match[] = [];

  for (const tier of TIERS) {
    const have = new Set<string>(matches.map((m) => m.league.slug)), missing = LEAGUE_REGISTRY.map((l) => l.slug as string).filter((s) => !have.has(s));
    const todo = selectProviders(tier, answered, matches.length > 0, have);
    for (const p of tier) if (p.configured() && !todo.includes(p)) attempts.push({ provider: p.id, ok: true, count: 0, skipped: true });
    const settled = await Promise.all(
      todo.map(async (provider) => {
        try {
          const { data, meta } = await provider.fetch({ date, leagues: missing });
          void recordHealth(provider.id, true, meta.latencyMs);
          const valid = data.filter((match) => {
            const issues = validateMatch(match);
            if (issues.length) log.warn("match rejected", { id: match.id, issues });
            return issues.length === 0;
          });
          attempts.push({ provider: provider.id, ok: true, count: valid.length });
          return { provider, matches: valid, ok: true };
        } catch (error) {
          const errorKind = error instanceof ProviderError ? error.kind : "unknown";
          void recordHealth(provider.id, false, undefined, errorKind);
          attempts.push({ provider: provider.id, ok: false, error: errorKind });
          return { provider, matches: [] as Match[], ok: false };
        }
      }),
    );
    for (const r of settled) {
      if (r.ok) answered.push(r.provider);
      for (const match of r.matches) {
        if (matches.some((kept) => sameFixture(kept, match))) continue;
        matches.push(match);
      }
    }
  }

  if (all.some((p) => p.configured()) && !answered.length) {
    throw new Error("All fixture providers failed");
  }
  matches.sort((a, b) => a.kickoffUtc.localeCompare(b.kickoffUtc));

  let lookahead: Match[] | undefined;
  if (!matches.length && theStatsApi.configured() && date >= new Date().toISOString().slice(0, 10)) {
    try { lookahead = (await theStatsApi.lookahead(date)).filter((m) => validateMatch(m).length === 0).slice(0, 40); } catch { /* the lookahead is a convenience, never a reason to fail */ }
  }

  const source = matches[0]?.provenance.source ?? answered[0]?.id ?? null;
  return { matches, source: source as Source | null, attempts, ...(lookahead?.length ? { lookahead } : {}) };
}

export async function getFixtures(date: string): Promise<FixturesResult> {
  const { value, stale } = await cached(
    `fixtures:${date}`,
    20 * 60_000,
    3 * 3_600_000,
    () => loadFixtures(date),
  );

  return {
    ...value,
    stale,
  };
}