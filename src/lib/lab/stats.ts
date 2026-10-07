import { normCdf } from "@/lib/engine/models/math";
/** Statistics for observed game data. Everything is computed from the numbers passed in; nothing is estimated from outside, and every analysis says when the sample is too small. */
export type Insufficient = { status: "insufficient"; need: number; have: number; message: string };
export const INSUFFICIENT = "Insufficient observations for this analysis";
const short = (need: number, have: number): Insufficient => ({ status: "insufficient", need, have, message: INSUFFICIENT });
export const sum = (v: number[]) => v.reduce((a, b) => a + b, 0), mean = (v: number[]) => sum(v) / v.length;
export const sd = (v: number[]) => { const m = mean(v); return Math.sqrt(sum(v.map(x => (x - m) ** 2)) / Math.max(1, v.length - 1)); };
const sorted = (v: number[]) => [...v].sort((a, b) => a - b);
export const quantile = (s: number[], q: number) => { const i = (s.length - 1) * q, lo = Math.floor(i), hi = Math.ceil(i); return s[lo] + (s[hi] - s[lo]) * (i - lo); };
const lgamma = (z: number): number => { const c = [676.5203681218851, -1259.1392167224028, 771.32342877765313, -176.61502916214059, 12.507343278686905, -0.13857109526572012, 9.9843695780195716e-6, 1.5056327351493116e-7]; z -= 1; let x = 0.99999999999980993; c.forEach((v, i) => (x += v / (z + i + 1))); const t = z + 7.5; return 0.5 * Math.log(2 * Math.PI) + (z + 0.5) * Math.log(t) - t + Math.log(x); };
function gammaP(a: number, x: number): number {
  if (x <= 0) return 0; const g = lgamma(a);
  if (x < a + 1) { let ap = a, s = 1 / a, d = s; for (let n = 0; n < 300; n++) { ap++; d *= x / ap; s += d; if (Math.abs(d) < Math.abs(s) * 1e-13) break; } return s * Math.exp(-x + a * Math.log(x) - g); }
  let b = x + 1 - a, c = 1e30, d = 1 / b, h = d; for (let i = 1; i < 300; i++) { const an = -i * (i - a); b += 2; d = an * d + b; if (Math.abs(d) < 1e-30) d = 1e-30; c = b + an / c; if (Math.abs(c) < 1e-30) c = 1e-30; d = 1 / d; const del = d * c; h *= del; if (Math.abs(del - 1) < 1e-13) break; }
  return 1 - Math.exp(-x + a * Math.log(x) - g) * h;
}
export const chiSquareP = (stat: number, df: number) => Math.max(0, Math.min(1, 1 - gammaP(df / 2, stat / 2)));
const ksP = (d: number, n1: number, n2: number) => { const en = Math.sqrt((n1 * n2) / (n1 + n2)), l = (en + 0.12 + 0.11 / en) * d; let s = 0; for (let k = 1; k <= 100; k++) s += 2 * (k % 2 ? 1 : -1) * Math.exp(-2 * k * k * l * l); return Math.max(0, Math.min(1, s)); };
const r4 = (x: number) => Math.round(x * 10_000) / 10_000;

export function summary(v: number[]) {
  if (!v.length) return short(1, 0); const s = sorted(v);
  return { status: "ok" as const, count: v.length, mean: r4(mean(v)), median: r4(quantile(s, 0.5)), sd: r4(v.length > 1 ? sd(v) : 0), variance: r4(v.length > 1 ? sd(v) ** 2 : 0), p95: r4(quantile(s, 0.95)), p99: r4(quantile(s, 0.99)), min: s[0], max: s[s.length - 1] };
}
/** Bucket edges are configurable: nothing assumes one set of thresholds fits every game. */
export const DEFAULT_EDGES = [1.2, 1.5, 2, 3, 5, 10];
export function distribution(v: number[], edges = DEFAULT_EDGES) {
  if (!v.length) return short(1, 0); const e = [...edges].sort((a, b) => a - b), counts = new Array(e.length + 1).fill(0);
  for (const x of v) { let i = 0; while (i < e.length && x >= e[i]) i++; counts[i]++; }
  const label = (i: number) => (i === 0 ? `< ${e[0]}` : i === e.length ? `${e[e.length - 1]}+` : `${e[i - 1]}–${e[i]}`);
  const buckets = counts.map((c, i) => ({ label: label(i), count: c, share: r4(c / v.length) })), H = -buckets.reduce((a, b) => a + (b.share > 0 ? b.share * Math.log(b.share) : 0), 0);
  return { status: "ok" as const, buckets, entropy: r4(H / Math.log(buckets.length)) };
}
/** Runs of consecutive observations below the threshold, with the run length you would expect if every observation were independent. A long run is a record of what happened, not a signal about the next one. */
export function streaks(v: number[], threshold: number) {
  if (v.length < 30) return short(30, v.length);
  const below = v.map(x => x < threshold), p = below.filter(Boolean).length / v.length; const runs: number[] = []; let cur = 0;
  for (const b of below) { if (b) cur++; else { if (cur) runs.push(cur); cur = 0; } } const open = cur; if (cur) runs.push(cur);
  const hist = [1, 2, 3, 4].map(k => ({ length: String(k), runs: runs.filter(r => r === k).length })).concat([{ length: "5+", runs: runs.filter(r => r >= 5).length }]);
  const expectedLongest = p > 0 && p < 1 ? Math.log(v.length * (1 - p)) / -Math.log(p) : null;
  return { status: "ok" as const, threshold, shareBelow: r4(p), longest: runs.length ? Math.max(...runs) : 0, current: below[below.length - 1] ? { type: "below" as const, length: open } : { type: "at-or-above" as const, length: [...below].reverse().findIndex(b => b) === -1 ? below.length : [...below].reverse().findIndex(b => b) }, runCount: runs.length, histogram: hist, expectedLongestIfIndependent: expectedLongest == null ? null : r4(expectedLongest) };
}
export function rolling(v: number[], window: number) {
  if (window < 2 || v.length < window * 2) return short(window * 2, v.length); const pts: { end: number; mean: number; sd: number }[] = [];
  for (let i = window; i <= v.length; i++) { const w = v.slice(i - window, i); pts.push({ end: i, mean: r4(mean(w)), sd: r4(sd(w)) }); }
  const all = sd(v), last = pts[pts.length - 1];
  return { status: "ok" as const, window, points: pts.length > 300 ? pts.filter((_, i) => i % Math.ceil(pts.length / 300) === 0 || i === pts.length - 1) : pts, overallSd: r4(all), latestSd: last.sd, latestVsOverall: all ? r4(last.sd / all) : null };
}
export function autocorrelation(v: number[], maxLag = 10) {
  if (v.length < 100) return short(100, v.length); const m = mean(v), den = sum(v.map(x => (x - m) ** 2)) || 1, band = 1.96 / Math.sqrt(v.length);
  const lags = Array.from({ length: maxLag }, (_, i) => { const k = i + 1; let n = 0; for (let t = 0; t + k < v.length; t++) n += (v[t] - m) * (v[t + k] - m); const r = n / den; return { lag: k, r: r4(r), outsideBand: Math.abs(r) > band }; });
  return { status: "ok" as const, band: r4(band), lags, outside: lags.filter(l => l.outsideBand).length, expectedOutsideByChance: r4(maxLag * 0.05) };
}
/** Wald-Wolfowitz runs test around the median: too few runs means clustering, too many means alternation. */
export function runsTest(v: number[]) {
  if (v.length < 100) return short(100, v.length); const med = quantile(sorted(v), 0.5), s = v.filter(x => x !== med).map(x => x > med), n1 = s.filter(Boolean).length, n2 = s.length - n1, n = n1 + n2; if (n1 < 10 || n2 < 10) return short(100, v.length);
  let R = 1; for (let i = 1; i < s.length; i++) if (s[i] !== s[i - 1]) R++;
  const mu = (2 * n1 * n2) / n + 1, vr = (2 * n1 * n2 * (2 * n1 * n2 - n)) / (n * n * (n - 1)), z = (R - mu) / Math.sqrt(vr);
  return { status: "ok" as const, runs: R, expectedRuns: r4(mu), z: r4(z), p: r4(2 * (1 - normCdf(Math.abs(z)))) };
}
/** Compares observed bucket counts with expected shares you supply. There is no built-in expectation: without one the test is not run. */
export function chiSquareFit(counts: number[], expected: number[]) {
  const n = sum(counts); if (n < 100 || counts.length !== expected.length || counts.length < 2) return short(100, n);
  const tot = sum(expected), e = expected.map(x => (x / tot) * n); if (e.some(x => x < 5)) return { status: "insufficient" as const, need: 5, have: Math.min(...e), message: "Some expected bucket counts are below 5, so the chi-square test would be unreliable. Merge buckets or collect more observations." };
  const stat = sum(counts.map((c, i) => (c - e[i]) ** 2 / e[i])), df = counts.length - 1; return { status: "ok" as const, statistic: r4(stat), df, p: r4(chiSquareP(stat, df)) };
}
export function ksTwoSample(a: number[], b: number[]) {
  if (a.length < 30 || b.length < 30) return short(30, Math.min(a.length, b.length)); const A = sorted(a), B = sorted(b); let i = 0, j = 0, d = 0;
  while (i < A.length && j < B.length) { const x = Math.min(A[i], B[j]); while (i < A.length && A[i] <= x) i++; while (j < B.length && B[j] <= x) j++; d = Math.max(d, Math.abs(i / A.length - j / B.length)); }
  return { status: "ok" as const, d: r4(d), p: r4(ksP(d, a.length, b.length)) };
}
/** Does the second half of the history look like the first? A small p is evidence the distribution moved. */
export const driftTest = (v: number[]) => (v.length < 100 ? short(100, v.length) : ksTwoSample(v.slice(0, Math.floor(v.length / 2)), v.slice(Math.floor(v.length / 2))));
export function dependency(v: number[], threshold: number) {
  if (v.length < 100) return short(100, v.length); let a = 0, b = 0, c = 0, d = 0; // a: low then high, b: low then low, c: high then high, d: high then low
  for (let i = 0; i + 1 < v.length; i++) { const lo = v[i] < threshold, nextHigh = v[i + 1] >= threshold; if (lo) { if (nextHigh) a++; else b++; } else if (nextHigh) c++; else d++; }
  const nLow = a + b, nHigh = c + d; if (nLow < 10 || nHigh < 10) return short(100, v.length);
  const N = nLow + nHigh, col1 = a + c, col2 = b + d, exp = [nLow * col1 / N, nLow * col2 / N, nHigh * col1 / N, nHigh * col2 / N]; if (exp.some(x => x < 5)) return short(100, v.length);
  const stat = ((a - exp[0]) ** 2) / exp[0] + ((b - exp[1]) ** 2) / exp[1] + ((c - exp[2]) ** 2) / exp[2] + ((d - exp[3]) ** 2) / exp[3];
  return { status: "ok" as const, threshold, afterBelow: { n: nLow, shareAtOrAbove: r4(a / nLow) }, afterAtOrAbove: { n: nHigh, shareAtOrAbove: r4(c / nHigh) }, p: r4(chiSquareP(stat, 1)) };
}
/** Robust z-scores (median and MAD). Heavy tailed data will flag more points than a bell curve would, so a flag is a prompt to look, not proof of anything. */
export function anomalies(v: number[], times?: string[], cutoff = 3.5) {
  if (v.length < 50) return short(50, v.length); const med = quantile(sorted(v), 0.5), mad = quantile(sorted(v.map(x => Math.abs(x - med))), 0.5); if (!mad) return { status: "ok" as const, flagged: [], cutoff, note: "Median absolute deviation is zero, so robust scores are not defined." };
  const f = v.map((x, i) => ({ index: i, value: x, z: r4((0.6745 * (x - med)) / mad), at: times?.[i] ?? null })).filter(o => Math.abs(o.z) > cutoff).sort((a, b) => Math.abs(b.z) - Math.abs(a.z));
  return { status: "ok" as const, cutoff, flaggedCount: f.length, share: r4(f.length / v.length), flagged: f.slice(0, 10), note: "Flags measure distance from the median. Skewed data produces many flags by design." };
}
/** Largest standardised mean shift over all split points. Scanning every split inflates the statistic, so the labels are deliberately strict. */
export function changePoint(v: number[]) {
  if (v.length < 40) return short(40, v.length); const x = v.every(t => t > 0) ? v.map(Math.log) : v, n = x.length, pre = [0]; x.forEach((t, i) => pre.push(pre[i] + t)); const sq = [0]; x.forEach((t, i) => sq.push(sq[i] + t * t));
  let best = { t: 0, at: 0 };
  for (let c = 10; c <= n - 10; c++) { const m1 = pre[c] / c, m2 = (pre[n] - pre[c]) / (n - c), ss = sq[n] - c * m1 * m1 - (n - c) * m2 * m2, s2 = ss / (n - 2); if (!s2) continue; const t = Math.abs(m1 - m2) / Math.sqrt(s2 * (1 / c + 1 / (n - c))); if (t > best.t) best = { t, at: c }; }
  const evidence = best.t < 3.5 ? "none" : best.t < 4.5 ? "possible" : "strong";
  return { status: "ok" as const, index: best.at, statistic: r4(best.t), evidence: evidence as "none" | "possible" | "strong", scale: x === v ? "raw" as const : "log" as const, before: r4(mean(v.slice(0, best.at))), after: r4(mean(v.slice(best.at))) };
}
export function compare(a: number[], b: number[]) {
  if (a.length < 30 || b.length < 30) return short(30, Math.min(a.length, b.length));
  const all = [...a.map(x => ({ x, g: 0 })), ...b.map(x => ({ x, g: 1 }))].sort((p, q) => p.x - q.x); const ranks = new Array(all.length);
  for (let i = 0; i < all.length;) { let j = i; while (j + 1 < all.length && all[j + 1].x === all[i].x) j++; for (let k = i; k <= j; k++) ranks[k] = (i + j) / 2 + 1; i = j + 1; }
  const R1 = sum(all.map((o, i) => (o.g === 0 ? ranks[i] : 0))), n1 = a.length, n2 = b.length, U = R1 - (n1 * (n1 + 1)) / 2, z = (U - (n1 * n2) / 2) / Math.sqrt((n1 * n2 * (n1 + n2 + 1)) / 12);
  return { status: "ok" as const, a: summary(a), b: summary(b), ks: ksTwoSample(a, b), mannWhitney: { z: r4(z), p: r4(2 * (1 - normCdf(Math.abs(z)))) } };
}
export function analyse(v: number[], o: { window?: number; threshold?: number; edges?: number[]; times?: string[] } = {}) {
  const thr = o.threshold ?? 2;
  return { summary: summary(v), distribution: distribution(v, o.edges), streaks: streaks(v, thr), rolling: rolling(v, o.window ?? 20), randomness: { autocorrelation: autocorrelation(v), runs: runsTest(v), drift: driftTest(v) }, dependency: dependency(v, thr), anomalies: anomalies(v, o.times), changePoint: changePoint(v) };
}
export const ENGINE_VERSION = "lab-1.0.0";
