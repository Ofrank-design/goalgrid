import type { LeagueSlug, Match, MatchStatus } from "../../../types/football";
import { LEAGUE_REGISTRY } from "../../football/league-registry";
import type { HistMatch } from "../../../types/prediction";
import { teamSlug } from "../../engine/normalization/teams";
/** football-data.org competition codes, from the league registry. */
export const FD_COMPETITIONS: Record<string, { slug: LeagueSlug; name: string }> = Object.fromEntries(LEAGUE_REGISTRY.flatMap((l) => ("fd" in l ? [[l.fd, { slug: l.slug, name: l.name }]] : [])));
const STATUS: Record<string, MatchStatus> = { SCHEDULED: "scheduled", TIMED: "scheduled", IN_PLAY: "live", PAUSED: "live", FINISHED: "finished", AWARDED: "finished", POSTPONED: "postponed", SUSPENDED: "postponed", CANCELLED: "cancelled" };
interface FdTeam { id: number; name: string; shortName?: string | null; crest?: string | null }
export interface FdMatch { id: number; utcDate: string; status: string; matchday?: number | null; lastUpdated?: string; homeTeam: FdTeam; awayTeam: FdTeam; competition: { id: number; code: string; name: string }; score?: { fullTime?: { home: number | null; away: number | null } } }
const ttl = (s: MatchStatus) => (s === "live" ? 30_000 : s === "finished" ? 6 * 3_600_000 : 15 * 60_000);
const team = (t: FdTeam) => ({ providerId: String(t.id), name: t.name, shortName: t.shortName ?? null, slug: teamSlug(t.name), crestUrl: t.crest ?? null });
export function normalizeFootballData(raw: FdMatch[], now = new Date()): Match[] {
  const out: Match[] = [];
  for (const m of raw) {
    const comp = FD_COMPETITIONS[m.competition?.code]; if (!comp || !m.homeTeam || !m.awayTeam) continue;
    const status = STATUS[m.status] ?? "unknown";
    out.push({ id: `fd:${m.id}`, league: { slug: comp.slug, name: comp.name, providerId: String(m.competition.id) }, home: team(m.homeTeam), away: team(m.awayTeam), kickoffUtc: m.utcDate, status,
      score: { home: m.score?.fullTime?.home ?? null, away: m.score?.fullTime?.away ?? null }, matchday: m.matchday ?? null, venue: null,
      provenance: { source: "football-data", retrievedAt: now.toISOString(), sourceTimestamp: m.lastUpdated ?? null, expiresAt: new Date(now.getTime() + ttl(status)).toISOString() } });
  }
  return out;
}
/** Finished matches with a full time score, as plain history for the models. */
export function normalizeHistory(raw: FdMatch[]): HistMatch[] {
  const out: HistMatch[] = [];
  for (const m of raw) { const h = m.score?.fullTime?.home, a = m.score?.fullTime?.away; if (m.status !== "FINISHED" || h == null || a == null || !m.homeTeam || !m.awayTeam) continue; out.push({ date: m.utcDate, home: teamSlug(m.homeTeam.name), away: teamSlug(m.awayTeam.name), hg: h, ag: a }); }
  return out;
}
