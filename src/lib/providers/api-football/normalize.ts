import type { Match, MatchStatus } from "../../../types/football";
import type { HistMatch } from "../../../types/prediction";
import { teamSlug } from "../../engine/normalization/teams";
import { byApiFootball } from "../../football/league-registry";

interface AfTeam { id: number; name: string; logo?: string | null }
/** The fields of API-Football's /fixtures response that we read. */
export interface AfFixture {
  fixture: { id: number; date: string; timestamp?: number; status?: { short?: string | null }; venue?: { name?: string | null } | null };
  league: { id: number; name?: string; round?: string | null };
  teams: { home: AfTeam; away: AfTeam };
  goals?: { home: number | null; away: number | null };
}

const LIVE = new Set(["1H", "HT", "2H", "ET", "BT", "P", "LIVE", "INT"]);
const DONE = new Set(["FT", "AET", "PEN"]);
const stateOf = (s?: string | null): MatchStatus =>
  !s ? "unknown" : s === "NS" || s === "TBD" ? "scheduled" : LIVE.has(s) ? "live" : DONE.has(s) ? "finished"
  : s === "PST" || s === "SUSP" ? "postponed" : s === "CANC" || s === "ABD" || s === "AWD" || s === "WO" ? "cancelled" : "unknown";
const ttl = (s: MatchStatus) => (s === "live" ? 30_000 : s === "finished" ? 6 * 3_600_000 : 15 * 60_000);
const team = (t: AfTeam) => ({ providerId: String(t.id), name: t.name, shortName: null, slug: teamSlug(t.name), crestUrl: t.logo ?? null });

/** Fixtures in competitions the registry knows about. Anything else in the response is ignored. */
export function normalizeApiFootball(raw: AfFixture[], now = new Date()): Match[] {
  const out: Match[] = [];
  for (const f of raw) {
    const lg = byApiFootball(f.league?.id);
    if (!lg || !f.teams?.home || !f.teams?.away) continue;
    const status = stateOf(f.fixture.status?.short);
    out.push({
      id: `af:${f.fixture.id}`,
      league: { slug: lg.slug, name: lg.name, providerId: String(f.league.id) },
      home: team(f.teams.home), away: team(f.teams.away),
      kickoffUtc: new Date(f.fixture.date).toISOString(), status,
      score: { home: f.goals?.home ?? null, away: f.goals?.away ?? null },
      matchday: Number.parseInt(/(\d+)\s*$/.exec(f.league.round ?? "")?.[1] ?? "", 10) || null,
      venue: f.fixture.venue?.name ? { name: f.fixture.venue.name, lat: null, lon: null } : null,
      provenance: { source: "api-football", retrievedAt: now.toISOString(), sourceTimestamp: f.fixture.timestamp ? new Date(f.fixture.timestamp * 1000).toISOString() : null, expiresAt: new Date(now.getTime() + ttl(status)).toISOString() },
    });
  }
  return out;
}

/** Finished matches with a full time score, as plain history for the models. */
export function normalizeApiFootballHistory(raw: AfFixture[]): HistMatch[] {
  const out: HistMatch[] = [];
  for (const f of raw) {
    const h = f.goals?.home, a = f.goals?.away;
    if (!DONE.has(f.fixture.status?.short ?? "") || h == null || a == null || !f.teams?.home || !f.teams?.away) continue;
    out.push({ date: new Date(f.fixture.date).toISOString(), home: teamSlug(f.teams.home.name), away: teamSlug(f.teams.away.name), hg: h, ag: a });
  }
  return out;
}
