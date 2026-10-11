import type { FittedModel, HistMatch, Model, ModelOutput } from "../../../types/prediction";
import { headToHeadOf } from "./context-stats";

/**
 * Head-to-head record. Past meetings of the two clubs nudge the league base rates for the venue, shrunk hard toward those base rates
 * (a prior worth `K` meetings) because a few old results say little. It abstains for clubs that have not met, and the ensemble
 * weighs it by how it does on matches it had not seen like every other model, so it earns weight or it does not.
 */
const K = 8, SLOPE = 0.9, MIN_MEETINGS = 2;
export const headToHead: Model = {
  id: "h2h", name: "Head-to-Head Record", family: "rating",
  about: "Past meetings of the two clubs, shrunk toward the league base rates for the venue.",
  fit(history: HistMatch[]): FittedModel | null {
    if (history.length < 60) return null;
    const c = [0, 0, 0]; for (const m of history) c[m.hg > m.ag ? 0 : m.hg === m.ag ? 1 : 2]++;
    const n = history.length, base = { home: (c[0] + 1) / (n + 3), draw: (c[1] + 1) / (n + 3), away: (c[2] + 1) / (n + 3) };
    return { predict(home: string, away: string): ModelOutput | null {
      const r = headToHeadOf(history, home, away, 10); if (r.meetings < MIN_MEETINGS) return null;
      const lift = (r.homeWins - r.awayWins) / (r.meetings + K), h = base.home * Math.exp(SLOPE * lift), a = base.away * Math.exp(-SLOPE * lift), s = h + base.draw + a;
      return { home: h / s, draw: base.draw / s, away: a / s };
    } };
  },
};
