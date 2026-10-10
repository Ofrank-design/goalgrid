import type { LeagueSlug, Match, MatchStatus } from "../../../types/football";
import type { TeamRating } from "../../../types/signals";
import { leagueEntry } from "../../football/league-registry";
import { teamSlug } from "../../engine/normalization/teams";
import { num } from "../resolve";

/** The fields of Big Balls' unified match object (/v1/matches) that we read. The same shape comes back for every league. */
export interface BbMatch { id: string; league?: string; kickoff_utc: string; status: string; round?: string | null; home: { id: string; name: string; short_name?: string | null; logo_url?: string | null }; away: { id: string; name: string; short_name?: string | null; logo_url?: string | null }; score?: { home: number | null; away: number | null } | null }
const STATUS: Record<string, MatchStatus> = { scheduled: "scheduled", live: "live", in_progress: "live", finished: "finished", postponed: "postponed", suspended: "postponed", cancelled: "cancelled" };
const ttl = (s: MatchStatus) => (s === "live" ? 30_000 : s === "finished" ? 6 * 3_600_000 : 15 * 60_000);
const team = (t: BbMatch["home"]) => ({ providerId: t.id, name: t.name, shortName: t.short_name ?? null, slug: teamSlug(t.name), crestUrl: t.logo_url ?? null });

export function normalizeBigBalls(raw: BbMatch[], slug: LeagueSlug, now = new Date()): Match[] {
  const lg = leagueEntry(slug), out: Match[] = []; if (!lg) return out;
  for (const m of raw) {
    if (!m.id || !m.home?.id || !m.away?.id || !m.home.name || !m.away.name) continue;
    const t = Date.parse(m.kickoff_utc); if (!Number.isFinite(t)) continue; const status = STATUS[m.status] ?? "unknown";
    out.push({ id: `bb:${m.id}`, league: { slug, name: lg.name, providerId: lg.bb ?? "" }, home: team(m.home), away: team(m.away), kickoffUtc: new Date(t).toISOString(), status,
      score: { home: m.score?.home ?? null, away: m.score?.away ?? null }, matchday: Number.parseInt(/(\d+)\s*$/.exec(m.round ?? "")?.[1] ?? "", 10) || null, venue: null,
      provenance: { source: "big-balls", retrievedAt: now.toISOString(), sourceTimestamp: null, expiresAt: new Date(now.getTime() + ttl(status)).toISOString() } });
  }
  return out;
}

type Row = Record<string, unknown>;
const obj = (v: unknown): Row | null => (v && typeof v === "object" && !Array.isArray(v) ? (v as Row) : null);
/** GET /v1/teams/{id}/elo. The rating is read from the first of its likely names; a rating outside 500 to 3000 is treated as missing, not trusted. */
export function readElo(data: unknown): { elo: number | null; leagueRank: number | null } {
  const d = obj(data), elo = num(d?.rating ?? d?.elo ?? d?.elo_rating ?? d?.value), rank = num(d?.league_rank ?? d?.rank);
  return { elo: elo != null && elo >= 500 && elo <= 3000 ? elo : null, leagueRank: rank != null && Number.isInteger(rank) && rank > 0 ? rank : null };
}
/** `form_string` on the team's stats block: most recent results first, as "WLWLL". */
export function readForm(data: unknown): string | null {
  const stats = obj(obj(data)?.stats) ?? obj(data), s = typeof stats?.form_string === "string" ? stats.form_string.replace(/[^WDLwdl]/g, "").toUpperCase() : "";
  return s || null;
}
export function toRating(elo: { elo: number | null; leagueRank: number | null }, form: string | null, observedAt = new Date().toISOString()): TeamRating | null {
  return elo.elo == null && form == null ? null : { elo: elo.elo, leagueRank: elo.leagueRank, form, observedAt, source: "big-balls" };
}
