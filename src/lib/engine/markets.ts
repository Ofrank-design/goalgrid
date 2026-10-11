import type { Match } from "../../types/football";
import type { Prediction } from "../../types/prediction";
import { analysisOf } from "./analysis";

/** Every market from one prediction, in one consistent set: the three outcomes sum to 1, Under is 1 minus Over, Double Chance is built from the outcomes, and the Over lines never rise with the line. */
export interface Markets {
  outcome1X2: { homeWin: number; draw: number; awayWin: number };
  bothTeamsToScore: { ggYes: number; ggNo: number };
  overallGoals: { over15: number; under15: number; over25: number; under25: number; over35: number; under35: number };
  doubleChance: { homeOrDraw: number; awayOrDraw: number; homeOrAway: number };
}
const r3 = (x: number) => Math.round(x * 1000) / 1000, clamp = (x: number) => (Number.isFinite(x) ? Math.min(1, Math.max(0, x)) : 0);
/** P(total goals > line) for Poisson-distributed total goals; used only when a stored prediction predates the extra totals. */
function poissonOver(lambda: number, line: number): number { const l = Math.max(0.05, lambda); let p = Math.exp(-l), cdf = 0; for (let k = 0; k <= Math.floor(line); k++) { cdf += p; p *= l / (k + 1); } return 1 - cdf; }

export function marketsOf(p: Prediction): Markets {
  const raw = [p.probabilities.home, p.probabilities.draw, p.probabilities.away].map(clamp), sum = raw[0] + raw[1] + raw[2] || 1;
  const homeWin = r3(raw[0] / sum), awayWin = r3(raw[2] / sum), draw = r3(1 - homeWin - awayWin), lam = p.expectedGoals.home + p.expectedGoals.away;
  const o25 = clamp(p.over25), o15 = Math.max(o25, clamp(p.over15 ?? poissonOver(lam, 1))), o35 = Math.min(o25, clamp(p.over35 ?? poissonOver(lam, 3))), yes = clamp(p.btts);
  return {
    outcome1X2: { homeWin, draw, awayWin }, bothTeamsToScore: { ggYes: r3(yes), ggNo: r3(1 - yes) },
    overallGoals: { over15: r3(o15), under15: r3(1 - o15), over25: r3(o25), under25: r3(1 - o25), over35: r3(o35), under35: r3(1 - o35) },
    doubleChance: { homeOrDraw: r3(homeWin + draw), awayOrDraw: r3(awayWin + draw), homeOrAway: r3(homeWin + awayWin) },
  };
}

/** Problems in a set of markets, as readable strings. An empty list means the set is valid. */
export function marketProblems(m: Markets): string[] {
  const bad: string[] = [], all = [...Object.values(m.outcome1X2), ...Object.values(m.bothTeamsToScore), ...Object.values(m.overallGoals), ...Object.values(m.doubleChance)];
  if (all.some(v => !Number.isFinite(v) || v < 0 || v > 1)) bad.push("a probability is missing or outside 0 to 1");
  const t = m.outcome1X2.homeWin + m.outcome1X2.draw + m.outcome1X2.awayWin; if (Math.abs(t - 1) > 0.001) bad.push(`1X2 sums to ${t.toFixed(3)}`);
  const g = m.overallGoals; if (!(g.over15 >= g.over25 && g.over25 >= g.over35)) bad.push("over lines are not in order");
  return bad;
}

/** The response shape for one match: markets, scores and the written analysis. */
export function matchPayload(match: Match, p: Prediction, now = new Date()) {
  const a = p.analysis ?? analysisOf(match, p), markets = marketsOf(p);
  return { matchId: match.id, homeTeam: match.home.name, awayTeam: match.away.name, predictionTime: now.toISOString(), confidenceScore: p.confidence, dataQualityScore: Math.round(clamp(p.dataQuality) * 100), baseline: Boolean(p.baseline),
    markets, expectedGoals: p.expectedGoals, topScores: p.topScores ?? [p.mostLikelyScore],
    analysis: { summary: a.summary, form: a.form, tacticalFactor: a.tactical, uncertaintyNote: a.uncertainty } };
}
