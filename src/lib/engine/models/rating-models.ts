import type { Model } from "../../../types/prediction";
import { buildFeatures, expected, featureVec, HA } from "./features";
import { normalize, softmax } from "./math";
/** 6. Elo with goal difference scaling and home advantage. Draw probability shrinks as the rating gap grows. */
export const elo: Model = { id: "elo", name: "Elo", family: "rating", fit: hist => {
  if (hist.length < 30) return null; const { state: s } = buildFeatures(hist);
  return { predict: (h, a) => {
    if (!s.n.get(h) || !s.n.get(a)) return null;
    const rh = s.elo.get(h)!, ra = s.elo.get(a)!, E = expected(rh, ra), gap = rh + HA - ra, draw = Math.max(0.05, s.drawRate * 1.15 * Math.exp(-Math.pow(gap / 320, 2)));
    return normalize({ home: Math.max(E - draw / 2, 0.01), draw, away: Math.max(1 - E - draw / 2, 0.01) });
  } };
} };
const dot = (w: number[], x: number[]) => w.reduce((a, v, i) => a + v * (i < x.length ? x[i] : 1), 0);
/** 7. Multinomial logistic regression on Elo gap, recent points and recent goal difference. */
export const logistic: Model = { id: "logistic", name: "Logistic Regression", family: "machine-learning", fit: hist => {
  const { rows, state } = buildFeatures(hist); if (rows.length < 120) return null;
  const F = rows[0].x.length, W = [0, 1, 2].map(() => new Array(F + 1).fill(0));
  for (let ep = 0; ep < 300; ep++) {
    const g = [0, 1, 2].map(() => new Array(F + 1).fill(0));
    for (const r of rows) { const p = softmax(W.map(w => dot(w, r.x))); for (let k = 0; k < 3; k++) { const e = p[k] - (r.y === k ? 1 : 0); for (let j = 0; j < F; j++) g[k][j] += e * r.x[j]; g[k][F] += e; } }
    for (let k = 0; k < 3; k++) for (let j = 0; j <= F; j++) W[k][j] -= 0.4 * (g[k][j] / rows.length + 0.001 * W[k][j]);
  }
  return { predict: (h, a) => { const x = featureVec(state, h, a); if (!x) return null; const p = softmax(W.map(w => dot(w, x))); return { home: p[0], draw: p[1], away: p[2] }; } };
} };
interface Stump { k: number; j: number; t: number; l: number; r: number }
/** 8. Gradient boosted stumps (LogitBoost style, the same family of method as XGBoost) on the same features. */
export const boosted: Model = { id: "boosted-trees", name: "Gradient Boosted Trees", family: "machine-learning", fit: hist => {
  const { rows, state } = buildFeatures(hist); if (rows.length < 120) return null;
  const n = rows.length, F = rows[0].x.length, S = rows.map(() => [0, 0, 0]), stumps: Stump[] = [], LR = 0.08;
  const cands = Array.from({ length: F }, (_, j) => { const v = [...new Set(rows.map(r => r.x[j]))].sort((a, b) => a - b); return Array.from({ length: 12 }, (_, q) => v[Math.floor((q + 1) * v.length / 13)]).filter((x, i, a) => x !== undefined && a.indexOf(x) === i); });
  for (let round = 0; round < 50; round++) {
    const P = S.map(softmax);
    for (let k = 0; k < 3; k++) {
      let best: Stump | null = null, bg = -Infinity;
      for (let j = 0; j < F; j++) for (const t of cands[j]) {
        let rl = 0, hl = 0, nl = 0, rr = 0, hr = 0, nr = 0;
        for (let i = 0; i < n; i++) { const res = (rows[i].y === k ? 1 : 0) - P[i][k], h = P[i][k] * (1 - P[i][k]); if (rows[i].x[j] <= t) { rl += res; hl += h; nl++; } else { rr += res; hr += h; nr++; } }
        if (nl < 20 || nr < 20) continue; const gain = rl * rl / nl + rr * rr / nr;
        if (gain > bg) { bg = gain; const lv = (v: number, h: number) => Math.max(-2, Math.min(2, (2 / 3) * v / (h + 1e-6))) * LR; best = { k, j, t, l: lv(rl, hl), r: lv(rr, hr) }; }
      }
      if (best) { stumps.push(best); for (let i = 0; i < n; i++) S[i][k] += rows[i].x[best.j] <= best.t ? best.l : best.r; }
    }
  }
  return { predict: (h, a) => { const x = featureVec(state, h, a); if (!x) return null; const sc = [0, 0, 0]; for (const s of stumps) sc[s.k] += x[s.j] <= s.t ? s.l : s.r; const p = softmax(sc); return { home: p[0], draw: p[1], away: p[2] }; } };
} };
/** 9. Market consensus: bookmaker odds with the margin removed. Needs no history, only the odds for the fixture. */
export const marketModel: Model = { id: "market", name: "Market Consensus", family: "market", fit: () => ({ predict: (_h, _a, ctx) => ctx?.market ? { ...ctx.market } : null }) };
export const RATING_MODELS = [elo, logistic, boosted, marketModel];
