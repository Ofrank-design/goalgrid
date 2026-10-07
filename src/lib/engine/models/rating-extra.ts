import type { HistMatch, Model, ModelOutput } from "../../../types/prediction";
import { matrixFrom, normCdf, normInv, normPdf, poissonPmf, probsFromMatrix, solveLinear } from "./math";
import { onlineModel, ratingModel } from "./ordinal";
import { fitStrengths, lambdas } from "./strengths";
const teamsOf = (h: HistMatch[]) => [...new Set(h.flatMap(m => [m.home, m.away]))];
/** Massey: least squares on goal difference with a home advantage term and a light ridge. Returns ratings in goals. */
export function masseyFit(train: HistMatch[], ridge = 1) {
  if (train.length < 30) return null; const teams = teamsOf(train), ix = new Map(teams.map((t, i) => [t, i])), T = teams.length, N = T + 1;
  const A = Array.from({ length: N }, () => new Array(N).fill(0)), b = new Array(N).fill(0);
  for (const m of train) { const i = ix.get(m.home)!, j = ix.get(m.away)!, gd = m.hg - m.ag, v = new Array(N).fill(0); v[i] = 1; v[j] = -1; v[T] = 1; for (let p = 0; p < N; p++) if (v[p]) { b[p] += v[p] * gd; for (let q = 0; q < N; q++) if (v[q]) A[p][q] += v[p] * v[q]; } }
  for (let i = 0; i < T; i++) A[i][i] += ridge; A[T][T] += 1e-6; const x = solveLinear(A, b);
  return { rating: (t: string) => (ix.has(t) ? x[ix.get(t)!] : null), hfa: x[T] };
}
export const massey: Model = ratingModel("massey", "Massey Rating", "rating", train => { const f = masseyFit(train); return f && ((h, a) => { const rh = f.rating(h), ra = f.rating(a); return rh == null || ra == null ? null : rh - ra; }); });
/** Colley: wins and losses with a schedule adjustment, draws count as half. */
export const colley: Model = ratingModel("colley", "Colley Matrix Rating", "rating", train => {
  if (train.length < 30) return null; const teams = teamsOf(train), ix = new Map(teams.map((t, i) => [t, i])), T = teams.length, C = Array.from({ length: T }, (_, i) => { const r = new Array(T).fill(0); r[i] = 2; return r; }), b = new Array(T).fill(1);
  for (const m of train) { const i = ix.get(m.home)!, j = ix.get(m.away)!, s = m.hg > m.ag ? 1 : m.hg === m.ag ? 0.5 : 0; C[i][i]++; C[j][j]++; C[i][j]--; C[j][i]--; b[i] += (s - 0.5); b[j] += ((1 - s) - 0.5); }
  const r = solveLinear(C, b); return (h, a) => (ix.has(h) && ix.has(a) ? r[ix.get(h)!] - r[ix.get(a)!] : null);
});
/** PageRank: losers point at winners, weighted by margin, so beating strong teams counts for more. */
export const pageRank: Model = ratingModel("pagerank", "PageRank Team Rating", "rating", train => {
  if (train.length < 30) return null; const teams = teamsOf(train), ix = new Map(teams.map((t, i) => [t, i])), T = teams.length, W = Array.from({ length: T }, () => new Array(T).fill(0));
  for (const m of train) { const i = ix.get(m.home)!, j = ix.get(m.away)!, d = Math.abs(m.hg - m.ag); if (m.hg > m.ag) W[j][i] += 1 + 0.5 * d; else if (m.hg < m.ag) W[i][j] += 1 + 0.5 * d; else { W[i][j] += 0.5; W[j][i] += 0.5; } }
  let r = new Array(T).fill(1 / T); for (let it = 0; it < 80; it++) { const n = new Array(T).fill(0.15 / T); for (let i = 0; i < T; i++) { const out = W[i].reduce((a, b) => a + b, 0); if (!out) { for (let j = 0; j < T; j++) n[j] += 0.85 * r[i] / T; } else for (let j = 0; j < T; j++) n[j] += 0.85 * r[i] * W[i][j] / out; } r = n; }
  return (h, a) => (ix.has(h) && ix.has(a) ? Math.log(r[ix.get(h)!] / r[ix.get(a)!]) : null);
});
/** Bradley-Terry strengths by minorisation-maximisation. Draws count as half a win each way. */
export const bradleyTerry: Model = ratingModel("bradley-terry", "Bradley-Terry Model", "rating", train => {
  if (train.length < 30) return null; const teams = teamsOf(train), ix = new Map(teams.map((t, i) => [t, i])), T = teams.length, n = Array.from({ length: T }, () => new Array(T).fill(0)), w = new Array(T).fill(0.5);
  for (const m of train) { const i = ix.get(m.home)!, j = ix.get(m.away)!, s = m.hg > m.ag ? 1 : m.hg === m.ag ? 0.5 : 0; n[i][j]++; n[j][i]++; w[i] += s; w[j] += 1 - s; }
  let p = new Array(T).fill(1); for (let it = 0; it < 120; it++) { const q = p.map((pi, i) => { let d = 1 / (pi + 1); for (let j = 0; j < T; j++) if (n[i][j]) d += n[i][j] / (pi + p[j]); return w[i] / d; }); const g = Math.exp(q.reduce((a, x) => a + Math.log(x), 0) / T); p = q.map(x => x / g); }
  return (h, a) => (ix.has(h) && ix.has(a) ? Math.log(p[ix.get(h)!] / p[ix.get(a)!]) : null);
});
/** 22. Expected points from goals: a Pythagorean view of each team blended with the points it actually won, so lucky results count for less. */
export const expectedPoints: Model = ratingModel("expected-points", "Expected Points Model", "rating", train => {
  if (train.length < 30) return null; const t = new Map<string, { gf: number; ga: number; pts: number; n: number }>(), add = (k: string, gf: number, ga: number) => { const x = t.get(k) ?? { gf: 0, ga: 0, pts: 0, n: 0 }; x.gf += gf; x.ga += ga; x.pts += gf > ga ? 3 : gf === ga ? 1 : 0; x.n++; t.set(k, x); };
  for (const m of train) { add(m.home, m.hg, m.ag); add(m.away, m.ag, m.hg); }
  const rate = new Map<string, number>(); for (const [k, x] of t) { const e = 1.7, py = (x.gf + 1) ** e / ((x.gf + 1) ** e + (x.ga + 1) ** e), xp = 3 * py * 0.78 + 0.22 * 1.0, ap = x.pts / x.n; rate.set(k, 0.5 * ap + 0.5 * xp * 1.0); }
  return (h, a) => (rate.has(h) && rate.has(a) ? rate.get(h)! - rate.get(a)! : null);
});
/** 14. Skellam goal difference: the margin comes from Massey ratings, the total from attack and defence strengths, and the result is the distribution of the goal difference. */
export const skellam: Model = { id: "skellam", name: "Skellam Goal-Difference", family: "goals", fit: (hist, now) => {
  const ms = masseyFit(hist), s = fitStrengths(hist, now, 300); if (!ms || !s) return null;
  return { predict: (h, a): ModelOutput | null => { const rh = ms.rating(h), ra = ms.rating(a), l = lambdas(s, h, a); if (rh == null || ra == null || !l) return null;
    const T = Math.min(Math.max(l.lh + l.la, 1.2), 5), d = Math.min(Math.max(rh - ra + ms.hfa, -T + 0.3), T - 0.3), lh = (T + d) / 2, la = (T - d) / 2, m = matrixFrom((x, y) => poissonPmf(x, lh) * poissonPmf(y, la));
    return { ...probsFromMatrix(m), lambdaHome: lh, lambdaAway: la, matrix: m }; } };
} };
/** 24. Glicko-2: rating, rating deviation and volatility, updated after every match. */
const Q = 173.7178, g2 = (phi: number) => 1 / Math.sqrt(1 + 3 * phi * phi / (Math.PI * Math.PI));
interface G2 { mu: number; phi: number; sig: number }
function glickoUpdate(p: G2, opp: G2, s: number, hfa: number): G2 {
  const gj = g2(opp.phi), E = 1 / (1 + Math.exp(-gj * (p.mu + hfa - opp.mu))), v = 1 / (gj * gj * E * (1 - E)), delta = v * gj * (s - E), a = Math.log(p.sig * p.sig), tau = 0.5, p2 = p.phi * p.phi;
  const f = (x: number) => { const ex = Math.exp(x); return ex * (delta * delta - p2 - v - ex) / (2 * (p2 + v + ex) ** 2) - (x - a) / (tau * tau); };
  let A = a, B: number; if (delta * delta > p2 + v) B = Math.log(delta * delta - p2 - v); else { let k = 1; while (f(a - k * tau) < 0 && k < 50) k++; B = a - k * tau; }
  let fA = f(A), fB = f(B); for (let i = 0; i < 40 && Math.abs(B - A) > 1e-6; i++) { const den = fB - fA; if (!den) break; const C = A + (A - B) * fA / den, fC = f(C); if (fC * fB <= 0) { A = B; fA = fB; } else fA /= 2; B = C; fB = fC; }
  const sigN = Math.exp(A / 2), phiS = Math.sqrt(p2 + sigN * sigN), phiN = 1 / Math.sqrt(1 / (phiS * phiS) + 1 / v);
  return { mu: p.mu + phiN * phiN * gj * (s - E), phi: phiN, sig: sigN };
}
const HFA = 65 / Q;
export const glicko2: Model = onlineModel("glicko-2", "Glicko-2", () => new Map<string, G2>(),
  (s, h, a) => (s.has(h) && s.has(a) ? s.get(h)!.mu + HFA - s.get(a)!.mu : null),
  (s, m) => { const init = (): G2 => ({ mu: 0, phi: 350 / Q, sig: 0.06 }), H = s.get(m.home) ?? init(), A = s.get(m.away) ?? init(), sc = m.hg > m.ag ? 1 : m.hg === m.ag ? 0.5 : 0; s.set(m.home, glickoUpdate(H, A, sc, HFA)); s.set(m.away, glickoUpdate(A, H, 1 - sc, -HFA)); });
/** 25. TrueSkill with draws: a Gaussian belief per team, updated by the factor graph rules for win, draw and loss. */
interface TS { mu: number; s2: number }
const vw = (t: number, e: number) => normPdf(t - e) / Math.max(normCdf(t - e), 1e-9), ww = (t: number, e: number) => { const v = vw(t, e); return v * (v + t - e); };
const vd = (t: number, e: number) => (normPdf(-e - t) - normPdf(e - t)) / Math.max(normCdf(e - t) - normCdf(-e - t), 1e-9);
const wd = (t: number, e: number) => { const den = Math.max(normCdf(e - t) - normCdf(-e - t), 1e-9), v = vd(t, e); return v * v + ((e - t) * normPdf(e - t) + (e + t) * normPdf(e + t)) / den; };
const S0 = 25 / 3, BETA = S0 / 2, TAU2 = (S0 / 100) ** 2, HA_TS = 0.3 * BETA;
export const trueSkill: Model = onlineModel("trueskill", "TrueSkill Team Rating", () => ({ t: new Map<string, TS>(), draws: 0, n: 0 }),
  (s, h, a) => (s.t.has(h) && s.t.has(a) ? (s.t.get(h)!.mu + HA_TS - s.t.get(a)!.mu) / Math.sqrt(2 * BETA * BETA + s.t.get(h)!.s2 + s.t.get(a)!.s2) : null),
  (s, m) => {
    const H0 = s.t.get(m.home) ?? { mu: 25, s2: S0 * S0 }, A0 = s.t.get(m.away) ?? { mu: 25, s2: S0 * S0 }, sh = H0.s2 + TAU2, sa = A0.s2 + TAU2, c2 = 2 * BETA * BETA + sh + sa, c = Math.sqrt(c2), dr = (s.draws + 2) / (s.n + 6);
    const e = Math.SQRT2 * BETA * normInv((1 + dr) / 2) / c, t = (H0.mu + HA_TS - A0.mu) / c; let dh: number, da: number, w: number;
    if (m.hg === m.ag) { const v = vd(t, e); w = wd(t, e); dh = sh / c * v; da = -sa / c * v; } else if (m.hg > m.ag) { const v = vw(t, e); w = ww(t, e); dh = sh / c * v; da = -sa / c * v; } else { const v = vw(-t, e); w = ww(-t, e); dh = -sh / c * v; da = sa / c * v; }
    s.t.set(m.home, { mu: H0.mu + dh, s2: Math.max(sh * (1 - sh / c2 * w), 0.5) }); s.t.set(m.away, { mu: A0.mu + da, s2: Math.max(sa * (1 - sa / c2 * w), 0.5) }); s.n++; if (m.hg === m.ag) s.draws++;
  });
