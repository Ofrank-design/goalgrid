import type { Model } from "../../../types/prediction";
import { classifier, norm, softmaxFit, stats } from "./ml-extra";
import { fitOrdered } from "./ordinal";
import { invDet, fitTemp } from "./extra-math";
import { softmax, solveLinear } from "./math";
const dot = (w: number[], x: number[]) => w.reduce((s, v, j) => s + v * x[j], 0);
/** 51. Ordinal logistic: a linear score of the features predicts the goal margin, an ordered logit turns it into home, draw, away. */
export const ordinalLogistic: Model = classifier("ordinal-logistic", "Ordinal Logistic Outcome Model", "machine-learning", rows => {
  const st = stats(rows), X = rows.map(r => [...norm(r.xe, st), 1]), F = X[0].length, A = Array.from({ length: F }, () => new Array(F).fill(0)), b = new Array(F).fill(0);
  X.forEach((x, i) => { for (let p = 0; p < F; p++) { b[p] += x[p] * rows[i].gd; for (let q = 0; q < F; q++) A[p][q] += x[p] * x[q]; } });
  for (let p = 0; p < F - 1; p++) A[p][p] += rows.length * 0.02;
  const w = solveLinear(A, b), ord = fitOrdered(X.map((x, i) => ({ d: dot(w, x), y: rows[i].y }))); if (!ord) return null;
  return xe => { const p = ord(dot(w, [...norm(xe, st), 1])); return [p.home, p.draw, p.away]; };
});
/** Discriminant analysis. alpha 0 shares one covariance across outcomes (LDA), alpha 1 gives each outcome its own (QDA), in between is regularised (RDA). */
const discriminant = (id: string, name: string, alpha: number, gamma: number) => classifier(id, name, "machine-learning", rows => {
  const st = stats(rows), Z = rows.map(r => norm(r.xe, st)), F = Z[0].length, N = Z.length, idx = [0, 1, 2].map(k => Z.map((_, i) => i).filter(i => rows[i].y === k));
  if (idx.some(a => a.length < 12)) return null;
  const mu = idx.map(ix => Array.from({ length: F }, (_, j) => ix.reduce((s, i) => s + Z[i][j], 0) / ix.length));
  const Sk = [0, 1, 2].map(k => { const S = Array.from({ length: F }, () => new Array(F).fill(0)); for (const i of idx[k]) for (let a = 0; a < F; a++) for (let b = 0; b < F; b++) S[a][b] += (Z[i][a] - mu[k][a]) * (Z[i][b] - mu[k][b]); return S; });
  const pooled = Sk[0].map((r, a) => r.map((_, b) => (Sk[0][a][b] + Sk[1][a][b] + Sk[2][a][b]) / (N - 3)));
  const comps = [0, 1, 2].map(k => { const S = Sk[k].map((r, a) => r.map((v, b) => alpha * v / (idx[k].length - 1) + (1 - alpha) * pooled[a][b])), tr = S.reduce((s, r, a) => s + r[a], 0) / F;
    return { ...invDet(S.map((r, a) => r.map((v, b) => (1 - gamma) * v + (a === b ? gamma * tr + 1e-3 : 0)))), lp: Math.log(idx[k].length / N) }; });
  const lp = (z: number[]) => comps.map((c, k) => { const d = z.map((v, j) => v - mu[k][j]); let q = 0; for (let a = 0; a < F; a++) for (let b = 0; b < F; b++) q += d[a] * c.inv[a][b] * d[b]; return c.lp - 0.5 * c.logdet - 0.5 * q; });
  const T = fitTemp(Z.map(lp), rows.map(r => r.y)); return xe => softmax(lp(norm(xe, st)).map(v => v / T));
});
/** 53. Linear Discriminant Analysis. */ export const lda = discriminant("lda", "Linear Discriminant Analysis", 0, 0);
/** 54. Quadratic Discriminant Analysis. */ export const qda = discriminant("qda", "Quadratic Discriminant Analysis", 1, 0.05);
/** 55. Regularised Discriminant Analysis: halfway between the two, with shrinkage toward a spherical covariance. */ export const rda = discriminant("rda", "Regularised Discriminant Analysis", 0.5, 0.2);
/** 58. Generalised additive model: each feature gets a flexible piecewise linear curve, fitted jointly by penalised softmax regression. */
const basis = (z: number[]) => [...z.flatMap(v => [v, Math.max(0, v + 0.67), Math.max(0, v), Math.max(0, v - 0.67)]), 1];
export const gam: Model = classifier("gam", "Generalised Additive Model", "machine-learning", rows => {
  const st = stats(rows), X = rows.map(r => basis(norm(r.xe, st))), W = softmaxFit(X, rows.map(r => r.y), 250, 0.4, 0.02);
  return xe => softmax(W.map(w => dot(w, basis(norm(xe, st)))));
});
/** 60. Elastic net multinomial regression: L1 and L2 penalties, with a soft threshold step so weak features drop out. */
export const elasticNet: Model = classifier("elastic-net", "Elastic Net Multinomial Regression", "machine-learning", rows => {
  const st = stats(rows), X = rows.map(r => [...norm(r.xe, st), 1]), y = rows.map(r => r.y), F = X[0].length, W = [0, 1, 2].map(() => new Array(F).fill(0)), lr = 0.5, l1 = 0.004, l2 = 0.01;
  for (let ep = 0; ep < 250; ep++) {
    const g = [0, 1, 2].map(() => new Array(F).fill(0));
    X.forEach((x, i) => { const p = softmax(W.map(w => dot(w, x))); for (let k = 0; k < 3; k++) { const e = p[k] - (y[i] === k ? 1 : 0); for (let j = 0; j < F; j++) g[k][j] += e * x[j]; } });
    for (let k = 0; k < 3; k++) for (let j = 0; j < F; j++) { W[k][j] -= lr * (g[k][j] / X.length + l2 * W[k][j]); if (j < F - 1) W[k][j] = Math.sign(W[k][j]) * Math.max(Math.abs(W[k][j]) - lr * l1, 0); }
  }
  return xe => softmax(W.map(w => dot(w, [...norm(xe, st), 1])));
});
