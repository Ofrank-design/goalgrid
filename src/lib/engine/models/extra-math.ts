import { normalize, softmax } from "./math";
/** Gauss-Jordan inverse with log determinant, for the discriminant models. */
export function invDet(A: number[][]): { inv: number[][]; logdet: number } {
  const n = A.length, M = A.map((r, i) => [...r, ...Array.from({ length: n }, (_, j) => (i === j ? 1 : 0))]); let ld = 0;
  for (let c = 0; c < n; c++) {
    let p = c; for (let r = c + 1; r < n; r++) if (Math.abs(M[r][c]) > Math.abs(M[p][c])) p = r; [M[c], M[p]] = [M[p], M[c]];
    const d = M[c][c] || 1e-12; ld += Math.log(Math.abs(d)); for (let j = 0; j < 2 * n; j++) M[c][j] /= d;
    for (let r = 0; r < n; r++) if (r !== c) { const f = M[r][c]; if (f) for (let j = 0; j < 2 * n; j++) M[r][j] -= f * M[c][j]; }
  }
  return { inv: M.map(r => r.slice(n)), logdet: ld };
}
/** One temperature fitted on training rows, for models whose raw scores are overconfident. */
export function fitTemp(L: number[][], y: number[]): number {
  let best = 1, bl = Infinity;
  for (const T of [1, 1.5, 2, 3, 4, 6, 8, 12, 16, 24]) { let l = 0; L.forEach((lp, i) => (l -= Math.log(Math.max(softmax(lp.map(v => v / T))[y[i]], 1e-9)))); if (l < bl) { bl = l; best = T; } }
  return best;
}
/** Nudges a score matrix so chosen market totals match a target while the rest keeps its shape. Used by the single market models. */
export function tilt(m: number[][], t: { btts?: number; over25?: number; csHome?: number; csAway?: number }): number[][] {
  let M = m.map(r => [...r]);
  const apply = (pred: (x: number, y: number) => boolean, target: number) => {
    let a = 0; M.forEach((r, x) => r.forEach((v, y) => { if (pred(x, y)) a += v; })); a = Math.min(Math.max(a, 1e-6), 1 - 1e-6);
    const g = Math.min(Math.max(target, 0.01), 0.99); M = M.map((r, x) => r.map((v, y) => v * (pred(x, y) ? g / a : (1 - g) / (1 - a))));
  };
  for (let it = 0; it < 6; it++) {
    if (t.btts != null) apply((x, y) => x > 0 && y > 0, t.btts); if (t.over25 != null) apply((x, y) => x + y > 2, t.over25);
    if (t.csHome != null) apply((x, y) => y === 0, t.csHome); if (t.csAway != null) apply((x) => x === 0, t.csAway);
  }
  const s = M.reduce((a, r) => a + r.reduce((b, v) => b + v, 0), 0); return M.map(r => r.map(v => v / s));
}
export const asProbs = (p: number[]) => normalize({ home: p[0], draw: p[1], away: p[2] });
