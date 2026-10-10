import type { TeamRating, Unavailable } from "@/types/signals";
/** Pure rules for turning provider data into model inputs. No network, no secrets. */
const clamp = (x: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, x));
const out = (u: Unavailable) => u.injuries + u.suspensions;

/** Each extra player ruled out costs a side about 0.04 expected goals, capped at 0.4. A coarse prior (counts say nothing about who is missing), which is why the availability model is flagged as a prior and carries half weight. Positive means the home side is healthier. */
export const availabilityShiftFrom = (home: Unavailable, away: Unavailable): number => Math.round(clamp((out(away) - out(home)) * 0.04, -0.4, 0.4) * 1000) / 1000;

export const eloGap = (home: TeamRating | null, away: TeamRating | null): number | null => (home?.elo != null && away?.elo != null ? Math.round(home.elo - away.elo) : null);
