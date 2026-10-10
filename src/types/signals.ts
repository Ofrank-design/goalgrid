import type { Source } from "./football";
/** One value per side. null means the provider did not send it. It never means zero. */
export interface Pair { home: number | null; away: number | null }
/** Team statistics for one finished match. Post-match data: shown on result pages, never used to price that match. */
export interface MatchStatLine { source: Source; matchId: string; possession: Pair; shots: Pair; shotsOnTarget: Pair; passAccuracy: Pair; xg: Pair; observedAt: string }
export interface Unavailable { injuries: number; suspensions: number }
export interface TeamRating { elo: number | null; leagueRank: number | null; form: string | null; observedAt: string; source: Source }
export interface ModelNote { model: string; health: "degraded" | "unavailable"; reason: string }
/**
 * Everything the newer providers add before kickoff. Each part is independent: a missing part is null and is listed in `degraded`
 * with the model it affects, instead of failing the request. `predictionTime` is the freeze point every value was checked against.
 */
export interface MatchSignals {
  matchId: string; predictionTime: string;
  availability: { home: Unavailable; away: Unavailable } | null; availabilityShift: number | null;
  lineupsConfirmed: boolean | null;
  ratings: { home: TeamRating | null; away: TeamRating | null; eloGap: number | null } | null;
  degraded: ModelNote[]; notes: string[];
}
