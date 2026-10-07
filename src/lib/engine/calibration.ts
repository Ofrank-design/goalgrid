/** Per-model probability calibration. Isotonic regression (pool adjacent violators) per outcome, then renormalised. A calibrator is only kept when it beats the raw model on matches it was not fitted on. */
export function fitIsotonic(xs: number[], ys: number[]): (x: number) => number {
  const order = xs.map((_, i) => i).sort((a, b) => xs[a] - xs[b]), blocks: { x: number; y: number; w: number }[] = [];
  for (const i of order) { const last = blocks[blocks.length - 1]; if (last && last.x === xs[i]) { last.y = (last.y * last.w + ys[i]) / (last.w + 1); last.w++; continue; } blocks.push({ x: xs[i], y: ys[i], w: 1 }); while (blocks.length > 1 && blocks[blocks.length - 2].y > blocks[blocks.length - 1].y) { const b = blocks.pop()!, a = blocks.pop()!; blocks.push({ x: (a.x * a.w + b.x * b.w) / (a.w + b.w), y: (a.y * a.w + b.y * b.w) / (a.w + b.w), w: a.w + b.w }); } }
  return x => { if (x <= blocks[0].x) return blocks[0].y; if (x >= blocks[blocks.length - 1].x) return blocks[blocks.length - 1].y; let lo = 0, hi = blocks.length - 1; while (hi - lo > 1) { const m = (lo + hi) >> 1; if (blocks[m].x <= x) lo = m; else hi = m; } const t = (x - blocks[lo].x) / (blocks[hi].x - blocks[lo].x || 1); return blocks[lo].y + t * (blocks[hi].y - blocks[lo].y); };
}
export type Calibrator = (p: number[]) => number[];
export function fitCalibrator(preds: number[][], y: number[]): Calibrator {
  const f = [0, 1, 2].map(k => fitIsotonic(preds.map(p => p[k]), y.map(v => +(v === k))));
  return p => { const c = p.map((v, k) => Math.min(Math.max(f[k](v), 0.01), 0.98)), s = c[0] + c[1] + c[2]; return c.map(v => v / s); };
}
/** Expected calibration error for the home win probability, in equal width bins. */
export function ece(preds: number[][], y: number[], k = 0, bins = 10): number {
  const b = Array.from({ length: bins }, () => ({ p: 0, h: 0, n: 0 })); preds.forEach((p, i) => { const t = b[Math.min(bins - 1, Math.floor(p[k] * bins))]; t.p += p[k]; t.h += +(y[i] === k); t.n++; });
  const n = preds.length; return n ? b.reduce((a, t) => a + (t.n ? Math.abs(t.p / t.n - t.h / t.n) * t.n : 0), 0) / n : 0;
}
export const logLoss = (preds: number[][], y: number[]) => -preds.reduce((a, p, i) => a + Math.log(Math.max(p[y[i]], 1e-6)), 0) / Math.max(preds.length, 1);
