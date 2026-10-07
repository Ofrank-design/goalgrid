import type { HistMatch, Model, ModelOutput } from "../../../types/prediction";
import { matrixFrom, nbPmf, poissonPmf, probsFromMatrix } from "./math";
import { fitStrengths, lambdas, type Strengths } from "./strengths";
const out = (m: number[][], lh: number, la: number): ModelOutput => ({ ...probsFromMatrix(m), lambdaHome: lh, lambdaAway: la, matrix: m });
const clampL = (x: number) => Math.min(Math.max(x, 0.15), 4.5);
const wrap = (halfLife: number, build: (s: Strengths, h: HistMatch[], now: Date) => (lh: number, la: number) => number[][]) => (hist: HistMatch[], now: Date) => {
  const s = fitStrengths(hist, now, halfLife); if (!s) return null; const mk = build(s, hist, now);
  return { predict: (h: string, a: string) => { const l = lambdas(s, h, a); if (!l) return null; const lh = clampL(l.lh), la = clampL(l.la); return out(mk(lh, la), lh, la); } };
};
/** 1. Independent Poisson on attack and defence strengths. */
export const poisson: Model = { id: "poisson", name: "Poisson", family: "goals", fit: wrap(300, () => (lh, la) => matrixFrom((x, y) => poissonPmf(x, lh) * poissonPmf(y, la))) };
const tau = (x: number, y: number, lh: number, la: number, rho: number) => x === 0 && y === 0 ? 1 - lh * la * rho : x === 0 && y === 1 ? 1 + lh * rho : x === 1 && y === 0 ? 1 + la * rho : x === 1 && y === 1 ? 1 - rho : 1;
/** 2. Dixon Coles: Poisson with a low score correction (rho) estimated by likelihood, plus time decay. */
export const dixonColes: Model = { id: "dixon-coles", name: "Dixon-Coles", family: "goals", fit: wrap(240, (s, hist) => {
  let best = 0, bl = -Infinity;
  for (let rho = -0.2; rho <= 0.101; rho += 0.01) {
    let ll = 0; for (const m of hist) { const l = lambdas(s, m.home, m.away); if (!l || m.hg > 1 || m.ag > 1) continue; const t = tau(m.hg, m.ag, l.lh, l.la, rho); if (t <= 0) { ll = -Infinity; break; } ll += Math.log(t); }
    if (ll > bl) { bl = ll; best = rho; }
  }
  return (lh, la) => matrixFrom((x, y) => poissonPmf(x, lh) * poissonPmf(y, la) * tau(x, y, lh, la, best));
}) };
/** 3. Bivariate Poisson: a shared goal component lets the two scores correlate. */
export const bivariatePoisson: Model = { id: "bivariate-poisson", name: "Bivariate Poisson", family: "goals", fit: wrap(300, (_s, hist) => {
  const mh = hist.reduce((a, m) => a + m.hg, 0) / hist.length, ma = hist.reduce((a, m) => a + m.ag, 0) / hist.length;
  const cov = hist.reduce((a, m) => a + (m.hg - mh) * (m.ag - ma), 0) / hist.length, l3 = Math.min(Math.max(cov, 0.001), 0.25);
  const fact = (n: number) => { let f = 1; for (let i = 2; i <= n; i++) f *= i; return f; };
  const choose = (n: number, k: number) => fact(n) / (fact(k) * fact(n - k));
  return (lh, la) => { const l1 = Math.max(lh - l3, 0.05), l2 = Math.max(la - l3, 0.05);
    return matrixFrom((x, y) => { let s = 0; for (let k = 0; k <= Math.min(x, y); k++) s += choose(x, k) * choose(y, k) * fact(k) * Math.pow(l3 / (l1 * l2), k); return Math.exp(-(l1 + l2 + l3)) * Math.pow(l1, x) / fact(x) * Math.pow(l2, y) / fact(y) * s; }); };
}) };
/** 4. Negative binomial: same means, fatter tails, for matches with unusually many goals. */
export const negativeBinomial: Model = { id: "negative-binomial", name: "Negative Binomial", family: "goals", fit: wrap(300, (_s, hist) => {
  const g = hist.flatMap(m => [m.hg, m.ag]), mean = g.reduce((a, b) => a + b, 0) / g.length, v = g.reduce((a, b) => a + (b - mean) ** 2, 0) / g.length;
  const r = v > mean * 1.02 ? Math.min(mean * mean / (v - mean), 60) : 60;
  return (lh, la) => matrixFrom((x, y) => nbPmf(x, lh, r) * nbPmf(y, la, r));
}) };
/** 5. Recent form Poisson: the same idea with a 45 day half life, so it reacts quickly to form. */
export const recentForm: Model = { id: "recent-form", name: "Recent Form", family: "goals", fit: wrap(45, () => (lh, la) => matrixFrom((x, y) => poissonPmf(x, lh) * poissonPmf(y, la))) };
export const GOAL_MODELS = [poisson, dixonColes, bivariatePoisson, negativeBinomial, recentForm];
