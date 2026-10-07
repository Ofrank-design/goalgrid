import type { Probs } from "../../../types/prediction";
export const MAXG = 8;
const C = [0.99999999999980993, 676.5203681218851, -1259.1392167224028, 771.32342877765313, -176.61502916214059, 12.507343278686905, -0.13857109526572012, 9.9843695780195716e-6, 1.5056327351493116e-7];
export function lgamma(z: number): number {
  if (z < 0.5) return Math.log(Math.PI / Math.sin(Math.PI * z)) - lgamma(1 - z);
  z -= 1; let x = C[0]; for (let i = 1; i < 9; i++) x += C[i] / (z + i);
  const t = z + 7.5; return 0.5 * Math.log(2 * Math.PI) + (z + 0.5) * Math.log(t) - t + Math.log(x);
}
export const poissonPmf = (k: number, l: number) => Math.exp(k * Math.log(l) - l - lgamma(k + 1));
export const nbPmf = (k: number, mean: number, r: number) => Math.exp(lgamma(k + r) - lgamma(r) - lgamma(k + 1) + r * Math.log(r / (r + mean)) + k * Math.log(mean / (r + mean)));
export function matrixFrom(f: (x: number, y: number) => number): number[][] {
  const m: number[][] = []; let s = 0;
  for (let x = 0; x <= MAXG; x++) { m.push([]); for (let y = 0; y <= MAXG; y++) { const v = Math.max(0, f(x, y)); m[x].push(v); s += v; } }
  return m.map(r => r.map(v => v / s));
}
export function probsFromMatrix(m: number[][]): Probs {
  let home = 0, draw = 0, away = 0; m.forEach((r, x) => r.forEach((v, y) => { if (x > y) home += v; else if (x === y) draw += v; else away += v; }));
  return { home, draw, away };
}
export const softmax = (z: number[]) => { const m = Math.max(...z), e = z.map(v => Math.exp(v - m)), s = e.reduce((a, b) => a + b, 0); return e.map(v => v / s); };
export const normalize = (p: Probs): Probs => { const s = p.home + p.draw + p.away; return { home: p.home / s, draw: p.draw / s, away: p.away / s }; };
export const normPdf = (x: number) => Math.exp(-x * x / 2) / Math.sqrt(2 * Math.PI);
export function normCdf(x: number) { const t = 1 / (1 + 0.2316419 * Math.abs(x)), p = normPdf(x) * t * (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274)))); return x > 0 ? 1 - p : p; }
export function normInv(p: number) { let lo = -8, hi = 8; for (let i = 0; i < 60; i++) { const m = (lo + hi) / 2; if (normCdf(m) < p) lo = m; else hi = m; } return (lo + hi) / 2; }
/** Small seeded generator, so every fit and every posterior draw is repeatable. */
export function rng(seed: number) { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
export const hashStr = (s: string) => { let h = 2166136261; for (const c of s) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; };
export const randn = (r: () => number) => Math.sqrt(-2 * Math.log(Math.max(r(), 1e-12))) * Math.cos(2 * Math.PI * r());
export const outcomeIdx = (hg: number, ag: number): 0 | 1 | 2 => (hg > ag ? 0 : hg === ag ? 1 : 2);
export function solveLinear(A: number[][], b: number[]): number[] {
  const n = b.length, M = A.map((r, i) => [...r, b[i]]);
  for (let c = 0; c < n; c++) { let p = c; for (let r = c + 1; r < n; r++) if (Math.abs(M[r][c]) > Math.abs(M[p][c])) p = r; [M[c], M[p]] = [M[p], M[c]]; const d = M[c][c] || 1e-12; for (let j = c; j <= n; j++) M[c][j] /= d; for (let r = 0; r < n; r++) if (r !== c) { const f = M[r][c]; if (f) for (let j = c; j <= n; j++) M[r][j] -= f * M[c][j]; } }
  return M.map(r => r[n]);
}
