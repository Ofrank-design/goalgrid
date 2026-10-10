import type { LeagueSlug, Match, MatchStatus } from "../../../types/football";
import type { MatchStatLine, Pair } from "../../../types/signals";
import type { OddsEvent } from "../../../types/context";
import { leagueEntry } from "../../football/league-registry";
import { teamSlug } from "../../engine/normalization/teams";
import { num } from "../resolve";

/** The fields of TheStatsAPI's GET /football/matches rows that we read. */
export interface TsMatch { id: string; competition_id: string; matchday?: number | null; status: string; utc_date: string; home_team: { id: string; name: string }; away_team: { id: string; name: string }; score?: { home: number | null; away: number | null } | null }
const STATUS: Record<string, MatchStatus> = { scheduled: "scheduled", live: "live", finished: "finished", postponed: "postponed", cancelled: "cancelled" };
const ttl = (s: MatchStatus) => (s === "live" ? 30_000 : s === "finished" ? 6 * 3_600_000 : 15 * 60_000);
const team = (t: { id: string; name: string }) => ({ providerId: t.id, name: t.name, shortName: null, slug: teamSlug(t.name), crestUrl: null });

/** Matches for one competition. The competition is already known from the request, so rows carry no league lookup of their own. */
export function normalizeTsMatches(raw: TsMatch[], slug: LeagueSlug, now = new Date()): Match[] {
  const lg = leagueEntry(slug), out: Match[] = []; if (!lg) return out;
  for (const m of raw) {
    if (!m.home_team?.id || !m.away_team?.id || !m.utc_date) continue;
    const status = STATUS[m.status] ?? "unknown", t = Date.parse(m.utc_date); if (!Number.isFinite(t)) continue;
    out.push({ id: `ts:${m.id}`, league: { slug, name: lg.name, providerId: m.competition_id }, home: team(m.home_team), away: team(m.away_team), kickoffUtc: new Date(t).toISOString(), status,
      score: { home: m.score?.home ?? null, away: m.score?.away ?? null }, matchday: m.matchday ?? null, venue: null,
      provenance: { source: "thestatsapi", retrievedAt: now.toISOString(), sourceTimestamp: null, expiresAt: new Date(now.getTime() + ttl(status)).toISOString() } });
  }
  return out;
}

type Stat = { all?: { home?: unknown; away?: unknown } } | undefined;
const side = (s: Stat): Pair => ({ home: num(s?.all?.home), away: num(s?.all?.away) });
const ratio = (a: Pair, b: Pair): Pair => ({ home: a.home != null && b.home ? Math.round((a.home / b.home) * 1000) / 10 : null, away: a.away != null && b.away ? Math.round((a.away / b.away) * 1000) / 10 : null });

/** GET /football/matches/{id}/stats. A stat the provider did not collect stays null, so a model sees "missing" and not a false zero. */
export function readTsStats(data: unknown, matchId: string, observedAt = new Date().toISOString()): MatchStatLine | null {
  const d = data as { overview?: Record<string, Stat>; shots?: Record<string, Stat>; np_expected_goals?: Stat } | null | undefined; if (!d || typeof d !== "object") return null;
  const o = d.overview ?? {}, passes = side(o.passes), accurate = side(o.accurate_passes ?? d.shots?.accurate_passes);
  const line: MatchStatLine = { source: "thestatsapi", matchId, possession: side(o.ball_possession), shots: side(o.total_shots ?? d.shots?.total_shots), shotsOnTarget: side(o.shots_on_target ?? d.shots?.shots_on_target), passAccuracy: ratio(accurate, passes), xg: side(o.expected_goals ?? d.np_expected_goals), observedAt };
  const any = [line.possession, line.shots, line.shotsOnTarget, line.passAccuracy, line.xg].some(p => p.home != null || p.away != null);
  return any ? line : null;
}

/** TheStatsAPI sends decimal prices as strings ("1.810"). */
interface TsBook { bookmaker: string; markets?: { match_odds?: Record<"home" | "draw" | "away", { last_seen?: string | number }>; total_goals?: Record<string, { over?: { last_seen?: string | number }; under?: { last_seen?: string | number } }> } }
/**
 * Turns one match's bookmaker prices into the same OddsEvent shape the other odds providers use, so the existing margin removal
 * (buildMarket) is the single place that turns prices into probabilities. The latest price is used, never the opening one.
 */
export function tsOddsToEvent(books: TsBook[], m: Match, now = new Date()): OddsEvent | null {
  const bookmakers: OddsEvent["bookmakers"] = [];
  for (const b of books ?? []) {
    const mo = b.markets?.match_odds, h = num(mo?.home?.last_seen), d = num(mo?.draw?.last_seen), a = num(mo?.away?.last_seen); if (h == null || d == null || a == null || h <= 1 || d <= 1 || a <= 1) continue;
    const markets: OddsEvent["bookmakers"][number]["markets"] = [{ key: "h2h", outcomes: [{ name: m.home.name, price: h }, { name: "Draw", price: d }, { name: m.away.name, price: a }] }];
    const t = b.markets?.total_goals?.["2.5"], ov = num(t?.over?.last_seen), un = num(t?.under?.last_seen);
    if (ov != null && un != null && ov > 1 && un > 1) markets.push({ key: "totals", outcomes: [{ name: "Over", price: ov, point: 2.5 }, { name: "Under", price: un, point: 2.5 }] });
    bookmakers.push({ key: `tsa-${b.bookmaker.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`, title: b.bookmaker, last_update: now.toISOString(), markets });
  }
  return bookmakers.length ? { id: m.id, sport_key: m.league.slug, commence_time: m.kickoffUtc, home_team: m.home.name, away_team: m.away.name, bookmakers } : null;
}
