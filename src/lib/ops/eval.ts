export interface Pred { home: number; draw: number; away: number; btts: number | null; over25: number | null }
export interface Evaluated { outcome: "home" | "draw" | "away"; logLoss: number; brier: number; correct: boolean; bttsCorrect: boolean | null; over25Correct: boolean | null }
const KEYS = ["home", "draw", "away"] as const;
/** Scores one stored prediction against the final score. Log loss of 1.0986 is what guessing 1 in 3 scores. */
export function evaluate(p: Pred, hg: number, ag: number): Evaluated {
  const outcome = hg > ag ? "home" : hg === ag ? "draw" : "away", v = [p.home, p.draw, p.away], top = KEYS[v.indexOf(Math.max(...v))];
  return { outcome, logLoss: -Math.log(Math.max(p[outcome], 1e-6)), brier: KEYS.reduce((s, k) => s + (p[k] - (k === outcome ? 1 : 0)) ** 2, 0), correct: top === outcome,
    bttsCorrect: p.btts == null ? null : (p.btts >= 0.5) === (hg > 0 && ag > 0), over25Correct: p.over25 == null ? null : (p.over25 >= 0.5) === (hg + ag > 2) };
}
export interface EvalRow { correct: boolean; log_loss: number; brier: number; btts_correct: boolean | null; over25_correct: boolean | null; p_home: number; p_draw: number; p_away: number }
const rate = (xs: (boolean | null)[]) => { const k = xs.filter((x): x is boolean => x !== null); return k.length ? k.filter(Boolean).length / k.length : null; };
export function summarize(rows: EvalRow[]) {
  const n = rows.length; if (!n) return { n: 0, accuracy: null, logLoss: null, brier: null, baselineLogLoss: Math.log(3), bttsAccuracy: null, over25Accuracy: null };
  return { n, accuracy: rows.filter(r => r.correct).length / n, logLoss: rows.reduce((s, r) => s + Number(r.log_loss), 0) / n, brier: rows.reduce((s, r) => s + Number(r.brier), 0) / n, baselineLogLoss: Math.log(3), bttsAccuracy: rate(rows.map(r => r.btts_correct)), over25Accuracy: rate(rows.map(r => r.over25_correct)) };
}
/** When the model says 60%, does its favourite happen about 60% of the time? Each bin compares the stated and the actual hit rate. */
export function calibrationBins(rows: EvalRow[], edges = [0.33, 0.4, 0.5, 0.6, 0.7, 0.8, 1.01]) {
  return edges.slice(0, -1).map((lo, i) => { const hi = edges[i + 1], r = rows.filter(x => { const f = Math.max(Number(x.p_home), Number(x.p_draw), Number(x.p_away)); return f >= lo && f < hi; });
    return { lo, hi: Math.min(hi, 1), n: r.length, predicted: r.length ? r.reduce((s, x) => s + Math.max(Number(x.p_home), Number(x.p_draw), Number(x.p_away)), 0) / r.length : null, actual: r.length ? r.filter(x => x.correct).length / r.length : null }; });
}
