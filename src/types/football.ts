export type Source = "sportmonks" | "football-data" | "api-football" | "thestatsapi" | "goal-api" | "big-balls";
export type { LeagueSlug } from "@/lib/football/league-registry";
import type { LeagueSlug } from "@/lib/football/league-registry";
export type MatchStatus = "scheduled" | "live" | "finished" | "postponed" | "cancelled" | "unknown";
/** Keep the source and freshness alongside each record so stale data is visible. */
export interface Provenance { source: Source; retrievedAt: string; sourceTimestamp: string | null; expiresAt: string }
export interface TeamRef { providerId: string; name: string; shortName: string | null; slug: string; crestUrl: string | null }
export interface LeagueRef { slug: LeagueSlug; name: string; providerId: string }
export interface Match {
  id: string; league: LeagueRef; home: TeamRef; away: TeamRef; kickoffUtc: string; status: MatchStatus;
  score: { home: number | null; away: number | null }; matchday: number | null; venue: { name: string; lat: number | null; lon: number | null } | null; provenance: Provenance;
}
