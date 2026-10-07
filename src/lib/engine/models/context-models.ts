import type { FittedModel, Model, PredictCtx } from "../../../types/prediction";
import { buildFeatures, featureExt } from "./features";
import { matrixFrom, poissonPmf, probsFromMatrix, solveLinear } from "./math";
import { fitStrengths, lambdas } from "./strengths";
const clampL = (x: number) => Math.min(Math.max(x, 0.15), 4.5);
const shifted = (lh: number, la: number, shift: number, scale = 1) => { const h = clampL(lh * scale + shift / 2), a = clampL(la * scale - shift / 2), m = matrixFrom((x, y) => poissonPmf(x, h) * poissonPmf(y, a)); return { ...probsFromMatrix(m), lambdaHome: h, lambdaAway: a, matrix: m }; };
/** Context models adjust the strength based goal expectation. They only speak when their data is present. */
function adjuster(id: string, name: string, about: string, needs: string, prior: boolean, fitExtra: (hist: Parameters<Model["fit"]>[0], now: Date) => ((h: string, a: string, ctx?: PredictCtx) => number | { shift?: number; scale?: number } | null) | null): Model {
  return { id, name, family: "context", about, needs, prior, fit: (hist, now): FittedModel | null => { const s = fitStrengths(hist, now, 300), f = fitExtra(hist, now); if (!s || !f) return null;
    return { predict: (h, a, ctx) => { const r = f(h, a, ctx), l = lambdas(s, h, a); if (r == null || !l) return null; return typeof r === "number" ? shifted(l.lh, l.la, r) : shifted(l.lh, l.la, r.shift ?? 0, r.scale ?? 1); } }; } };
}
const signal = (id: string, name: string, key: "availabilityShift" | "lineupShift" | "tacticalShift" | "newsShift", needs: string) =>
  adjuster(id, name, "Reads an expected goal shift (home minus away) from a data feed and applies it to the strength based forecast.", needs, true, () => (_h, _a, ctx) => { const v = ctx?.signals?.[key]; return typeof v === "number" && Number.isFinite(v) ? Math.max(-1, Math.min(1, v)) : null; });
/** 45. Player availability: injuries, suspensions, expected and confirmed XI. */
export const availability = signal("player-availability", "Player Availability Impact Model", "availabilityShift", "injury, suspension and lineup feed (for example Sportmonks lineups and injuries)");
/** 46. Lineup strength: starting player quality against replacements. */
export const lineupStrength = signal("lineup-strength", "Lineup Strength Model", "lineupShift", "starting lineups with player ratings");
/** 47. Tactical matchup. */
export const tacticalMatchup = signal("tactical-matchup", "Tactical Matchup Model", "tacticalShift", "team style statistics: pressing, transitions, possession, set pieces");
/** 50. News and sentiment: structured, time stamped injury, manager and club news. */
export const newsSentiment = signal("news-sentiment", "News and Sentiment Context Model", "newsShift", "structured news signals extracted from headlines");
/** 48. Rest and congestion, fitted on history. Travel distance is not available, so it is left out. */
export const restCongestion = adjuster("rest-congestion", "Rest, Travel, and Congestion Model", "Goal margin regressed on the rest gap and the 14 day match load gap, fitted on history. Travel distance is not included.", "kickoff time (travel distance is not available)", false, hist => {
  const { rows } = buildFeatures(hist); if (rows.length < 150) return null; const A = [[0, 0, 0], [0, 0, 0], [0, 0, 0]], b = [0, 0, 0];
  for (const r of rows) { const v = [1, r.rc[0], r.rc[1]]; for (let i = 0; i < 3; i++) { b[i] += v[i] * r.gd; for (let j = 0; j < 3; j++) A[i][j] += v[i] * v[j]; } }
  for (let i = 1; i < 3; i++) A[i][i] += rows.length * 0.05; const [, b1, b2] = solveLinear(A, b), { state } = buildFeatures(hist);
  return (h, a, ctx) => { if (!ctx?.kickoffUtc) return null; const e = featureExt(state, h, a, Date.parse(ctx.kickoffUtc)); return e ? Math.max(-0.6, Math.min(0.6, b1 * e.rc[0] + b2 * e.rc[1])) : null; };
});
/** 49. Weather and venue. Conservative priors, not fitted: there is no weather history to fit on. */
export const weatherVenue = adjuster("weather-venue", "Weather and Venue Context Model", "Scales expected goals down a little in strong wind, heavy rain or extreme temperatures. These are fixed priors, not fitted values.", "forecast weather at kickoff", true, () => (_h, _a, ctx) => { const w = ctx?.weather; if (!w) return null; const f = 1 - (w.windKmh > 35 ? 0.04 : 0) - ((w.rainChancePct ?? 0) > 60 ? 0.03 : 0) - (w.tempC < 3 || w.tempC > 32 ? 0.02 : 0); return { scale: f }; });
