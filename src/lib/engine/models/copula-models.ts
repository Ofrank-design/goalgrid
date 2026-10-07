import type { FittedModel, Model, ModelOutput } from "../../../types/prediction";
import { MAXG, matrixFrom, normCdf, normInv, normPdf, poissonPmf, probsFromMatrix } from "./math";
import { fitStrengths, lambdas } from "./strengths";
const clampL = (x: number) => Math.min(Math.max(x, 0.15), 4.5), cdf = (l: number) => { const o = [0]; for (let k = 0; k <= MAXG; k++) o.push(o[k] + poissonPmf(k, l)); return o; };
type Cop = (u: number, v: number, th: number) => number;
const frank: Cop = (u, v, t) => (u <= 0 || v <= 0 ? 0 : Math.abs(t) < 1e-6 ? u * v : -Math.log(1 + (Math.exp(-t * u) - 1) * (Math.exp(-t * v) - 1) / (Math.exp(-t) - 1)) / t);
const clayton: Cop = (u, v, t) => (u <= 0 || v <= 0 ? 0 : Math.pow(Math.max(Math.pow(u, -t) + Math.pow(v, -t) - 1, 1e-12), -1 / t));
const gaussian: Cop = (u, v, r) => { if (u <= 0 || v <= 0) return 0; const a = normInv(Math.min(u, 1 - 1e-9)), b = normInv(Math.min(v, 1 - 1e-9)), sd = Math.sqrt(1 - r * r); let s = 0; const lo = -6, n = 24, h = (a - lo) / n; for (let i = 0; i <= n; i++) { const t = lo + i * h; s += (i === 0 || i === n ? 0.5 : 1) * normPdf(t) * normCdf((b - r * t) / sd) * h; } return s; };
/** The joint score probability is built from Poisson margins for each side, linked by a copula. */
const cell = (C: Cop, th: number, F: number[], G: number[], x: number, y: number) => C(F[x + 1], G[y + 1], th) - C(F[x], G[y + 1], th) - C(F[x + 1], G[y], th) + C(F[x], G[y], th);
function copulaModel(id: string, name: string, family: Model["family"], C: Cop, grid: number[], about: string): Model {
  return { id, name, family, about, fit: (hist, now): FittedModel | null => {
    const s = fitStrengths(hist, now, 300); if (!s || hist.length < 100) return null; const sub = hist.filter((_, i) => i % Math.max(1, Math.floor(hist.length / 500)) === 0);
    const pre = sub.flatMap(m => { const l = lambdas(s, m.home, m.away); return l ? [{ F: cdf(clampL(l.lh)), G: cdf(clampL(l.la)), x: Math.min(m.hg, MAXG), y: Math.min(m.ag, MAXG) }] : []; });
    let best = grid[0], bl = -Infinity; for (const th of grid) { let ll = 0; for (const o of pre) ll += Math.log(Math.max(cell(C, th, o.F, o.G, o.x, o.y), 1e-9)); if (ll > bl) { bl = ll; best = th; } }
    return { predict: (h, a): ModelOutput | null => { const l = lambdas(s, h, a); if (!l) return null; const lh = clampL(l.lh), la = clampL(l.la), F = cdf(lh), G = cdf(la), m = matrixFrom((x, y) => cell(C, best, F, G, x, y)); return { ...probsFromMatrix(m), lambdaHome: lh, lambdaAway: la, matrix: m }; } };
  } };
}
/** 82. Frank copula: symmetric dependence, can be negative or positive. */ export const frankCopula = copulaModel("frank-copula", "Frank Copula Score Model", "copula", frank, [-3, -2, -1, -0.5, 0.001, 0.5, 1, 2, 3], "Poisson margins joined by a Frank copula with the dependence fitted on history.");
/** 83. Clayton copula: stronger dependence among low scores. */ export const claytonCopula = copulaModel("clayton-copula", "Clayton Copula Score Model", "copula", clayton, [0.02, 0.1, 0.25, 0.5, 0.8, 1.2], "Poisson margins joined by a Clayton copula, which ties low scores together.");
/** 84. Gaussian copula. */ export const gaussianCopula = copulaModel("gaussian-copula", "Gaussian Copula Score Model", "copula", gaussian, [-0.3, -0.2, -0.1, -0.03, 0.03, 0.1, 0.2, 0.3], "Poisson margins joined by a Gaussian copula with the correlation fitted on history.");
