/** A match id is the provider prefix and the provider's own id: sm (Sportmonks), fd (football-data), ga (GOAL API), bb (Big Balls), af (API-Football), ts (TheStatsAPI). */
export const MATCH_ID_RE = /^(sm|fd|ga|bb|af|ts):[A-Za-z0-9_-]{1,64}$/;
