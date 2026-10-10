import type { LeagueSlug, Match, MatchStatus } from "../../../types/football";
import { teamSlug } from "../../engine/normalization/teams";
import { LEAGUE_REGISTRY } from "../../football/league-registry";
/** Sportmonks league ids, from the league registry. A plan only returns the leagues it covers. */
export const SM_LEAGUES: Record<number, { slug: LeagueSlug; name: string }> = Object.fromEntries(LEAGUE_REGISTRY.flatMap((l) => ("sm" in l ? [[l.sm, { slug: l.slug, name: l.name }]] : [])));
const LIVE = new Set(["INPLAY_1ST_HALF", "INPLAY_2ND_HALF", "HT", "BREAK", "INPLAY_ET", "INPLAY_PENALTIES", "LIVE", "1H", "2H", "ET"]);
const stateOf = (s?: string): MatchStatus => !s ? "unknown" : s === "NS" || s === "TBA" ? "scheduled" : LIVE.has(s) ? "live" : ["FT", "AET", "FT_PEN"].includes(s) ? "finished" : s === "POSTPONED" || s === "POSTP" ? "postponed" : s === "CANCELLED" || s === "CANC" ? "cancelled" : "unknown";
interface SmPart { id: number; name: string; short_code?: string | null; image_path?: string | null; meta?: { location?: string } }
export interface SmFixture { id: number; league_id: number; starting_at: string; starting_at_timestamp?: number; participants?: SmPart[]; state?: { short_name?: string; developer_name?: string }; scores?: { description: string; score: { goals: number; participant: string } }[]; round?: { name?: string }; venue?: { name?: string; latitude?: string | number | null; longitude?: string | number | null } | null }
const num = (v: unknown) => { const n = typeof v === "string" ? Number.parseFloat(v) : (v as number); return Number.isFinite(n) ? n : null; };
const ttl = (s: MatchStatus) => (s === "live" ? 30_000 : s === "finished" ? 6 * 3_600_000 : 15 * 60_000);
const team = (p: SmPart) => ({ providerId: String(p.id), name: p.name, shortName: p.short_code ?? null, slug: teamSlug(p.name), crestUrl: p.image_path ?? null });
export function normalizeSportmonks(raw: SmFixture[], now = new Date()): Match[] {
  const out: Match[] = [];
  for (const f of raw) {
    const lg = SM_LEAGUES[f.league_id], home = f.participants?.find(p => p.meta?.location === "home"), away = f.participants?.find(p => p.meta?.location === "away");
    if (!lg || !home || !away) continue;
    const status = stateOf(f.state?.developer_name ?? f.state?.short_name), cur = (side: string) => { const g = f.scores?.filter(s => s.description === "CURRENT" && s.score.participant === side); return g?.length ? g[g.length - 1].score.goals : null; };
    out.push({ id: `sm:${f.id}`, league: { slug: lg.slug, name: lg.name, providerId: String(f.league_id) }, home: team(home), away: team(away), kickoffUtc: new Date(f.starting_at.replace(" ", "T") + "Z").toISOString(), status,
      score: { home: cur("home"), away: cur("away") }, matchday: Number.parseInt(f.round?.name ?? "", 10) || null, venue: f.venue?.name ? { name: f.venue.name, lat: num(f.venue.latitude), lon: num(f.venue.longitude) } : null,
      provenance: { source: "sportmonks", retrievedAt: now.toISOString(), sourceTimestamp: f.starting_at_timestamp ? new Date(f.starting_at_timestamp * 1000).toISOString() : null, expiresAt: new Date(now.getTime() + ttl(status)).toISOString() } });
  }
  return out;
}
