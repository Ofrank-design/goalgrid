import type { FittedModel, HistMatch, Model, ModelOutput } from "../../../types/prediction";
import { fitOrdered } from "./ordinal";
import { asProbs, tilt } from "./extra-math";
import { matrixFrom, outcomeIdx, poissonPmf, probsFromMatrix, rng } from "./math";
import { fitStrengths, lambdas } from "./strengths";
const DAY = 86_400_000, clampL = (x: number) => Math.min(Math.max(x, 0.15), 4.5);
const byDate = (h: HistMatch[]) => [...h].sort((a, b) => a.date.localeCompare(b.date));
const fromMatrix = (m: number[][], lh: number, la: number): ModelOutput => ({ ...probsFromMatrix(m), lambdaHome: lh, lambdaAway: la, matrix: m });

/** Recency weighted counts per team, split by venue, for the Beta and Dirichlet style models. */
interface Rt { n: number; w: number; d: number; l: number; btts: number; over: number; cs: number; fts: number }
const mk = (): Rt => ({ n: 0, w: 0, d: 0, l: 0, btts: 0, over: 0, cs: 0, fts: 0 });
function rates(hist: HistMatch[], now: Date, hl: number) {
  const H = new Map<string, Rt>(), A = new Map<string, Rt>(), lg = mk(), get = (m: Map<string, Rt>, k: string) => m.get(k) ?? (m.set(k, mk()), m.get(k)!);
  for (const m of hist) {
    const t = Math.pow(0.5, Math.max(0, (now.getTime() - Date.parse(m.date)) / DAY) / hl), res = outcomeIdx(m.hg, m.ag), btts = m.hg > 0 && m.ag > 0 ? 1 : 0, over = m.hg + m.ag > 2 ? 1 : 0;
    const add = (r: Rt, win: number, draw: number, loss: number, cs: number, fts: number) => { r.n += t; r.w += t * win; r.d += t * draw; r.l += t * loss; r.btts += t * btts; r.over += t * over; r.cs += t * cs; r.fts += t * fts; };
    add(get(H, m.home), +(res === 0), +(res === 1), +(res === 2), +(m.ag === 0), +(m.hg === 0)); add(get(A, m.away), +(res === 2), +(res === 1), +(res === 0), +(m.hg === 0), +(m.ag === 0)); add(lg, +(res === 0), +(res === 1), +(res === 2), +(m.ag === 0), +(m.hg === 0));
  }
  return { H, A, lg };
}
const post = (x: number, n: number, prior: number, k = 10) => (x + k * prior) / (n + k);
type Ctx = { H: Rt; A: Rt; lg: Rt };
function rateModel(id: string, name: string, about: string, out: (c: Ctx, base: number[][], lh: number, la: number) => ModelOutput | null): Model {
  return { id, name, family: "bayesian", about, fit: (hist, now): FittedModel | null => {
    const s = fitStrengths(hist, now, 300), r = rates(hist, now, 150); if (!s) return null;
    return { predict: (h, a) => { const l = lambdas(s, h, a), H = r.H.get(h), A = r.A.get(a); if (!l || !H || !A || H.n < 3 || A.n < 3) return null; const lh = clampL(l.lh), la = clampL(l.la);
      return out({ H, A, lg: r.lg }, matrixFrom((x, y) => poissonPmf(x, lh) * poissonPmf(y, la)), lh, la); } };
  } };
}
/** 67. Dirichlet-multinomial form: each team's home or away record is a Dirichlet posterior with the league rates as prior. */
export const dirichletForm = rateModel("dirichlet-form", "Dirichlet-Multinomial Form Model", "Home team's home record and away team's away record, each shrunk toward league rates.", c => {
  const pw = c.lg.w / c.lg.n, pd = c.lg.d / c.lg.n, pl = c.lg.l / c.lg.n, K = 8;
  return { ...asProbs([(post(c.H.w, c.H.n, pw, K) + post(c.A.l, c.A.n, pw, K)) / 2, (post(c.H.d, c.H.n, pd, K) + post(c.A.d, c.A.n, pd, K)) / 2, (post(c.H.l, c.H.n, pl, K) + post(c.A.w, c.A.n, pl, K)) / 2]) };
});
/** 68. Beta-binomial both teams to score. The market rate is tilted into a Poisson score matrix; scored here on 1X2 only. */
export const betaBtts = rateModel("beta-binomial-btts", "Beta-Binomial BTTS Model", "Each team's BTTS rate is a Beta posterior toward the league rate; the score matrix is tilted to match.", (c, m, lh, la) => fromMatrix(tilt(m, { btts: (post(c.H.btts, c.H.n, c.lg.btts / c.lg.n) + post(c.A.btts, c.A.n, c.lg.btts / c.lg.n)) / 2 }), lh, la));
/** 69. Beta-binomial over 2.5 goals. */
export const betaOver = rateModel("beta-binomial-over25", "Beta-Binomial Over 2.5 Model", "Each team's over 2.5 rate is a Beta posterior toward the league rate; the score matrix is tilted to match.", (c, m, lh, la) => fromMatrix(tilt(m, { over25: (post(c.H.over, c.H.n, c.lg.over / c.lg.n) + post(c.A.over, c.A.n, c.lg.over / c.lg.n)) / 2 }), lh, la));
/** 70. Binomial clean sheets: chance each side keeps a clean sheet, from its own record and the opponent's failure to score. */
export const cleanSheet = rateModel("binomial-clean-sheet", "Binomial Clean-Sheet Model", "Clean sheet and failed-to-score rates shrunk toward league rates; the score matrix is tilted to match.", (c, m, lh, la) => {
  const pc = c.lg.cs / c.lg.n, pf = c.lg.fts / c.lg.n;
  return fromMatrix(tilt(m, { csHome: (post(c.H.cs, c.H.n, pc) + post(c.A.fts, c.A.n, pc)) / 2, csAway: (post(c.A.cs, c.A.n, pf) + post(c.H.fts, c.H.n, pf)) / 2 }), lh, la);
});

/** 76. Hidden Markov form state: two hidden states (good form, poor form) fitted by Baum-Welch on every team's results, venue aware. */
export const hmmForm: Model = { id: "hmm-form-state", name: "Hidden Markov Form-State Model", family: "state-space", about: "Two hidden form states learned from all teams' result sequences; next result chances come from each team's filtered state.", fit: (hist): FittedModel | null => {
  const seqs = new Map<string, { v: number; r: number }[]>();
  for (const m of byDate(hist)) { const r = outcomeIdx(m.hg, m.ag), push = (t: string, v: number, rr: number) => { const q = seqs.get(t) ?? []; q.push({ v, r: rr }); seqs.set(t, q); }; push(m.home, 0, r); push(m.away, 1, r === 0 ? 2 : r === 2 ? 0 : 1); }
  const S = [...seqs.entries()].filter(([, q]) => q.length >= 8); if (S.length < 6) return null;
  let pi = [0.5, 0.5], A = [[0.85, 0.15], [0.15, 0.85]], E = [[[0.55, 0.25, 0.2], [0.4, 0.25, 0.35]], [[0.3, 0.25, 0.45], [0.2, 0.25, 0.55]]];
  const forward = (q: { v: number; r: number }[], pi0: number[], A0: number[][], E0: number[][][]) => { const al: number[][] = [], c: number[] = [];
    q.forEach((o, t) => { const a = [0, 1].map(k => (t === 0 ? pi0[k] : al[t - 1][0] * A0[0][k] + al[t - 1][1] * A0[1][k]) * E0[k][o.v][o.r]), s = a[0] + a[1] || 1e-12; c.push(s); al.push(a.map(v => v / s)); }); return { al, c }; };
  for (let it = 0; it < 15; it++) {
    const nPi = [0.5, 0.5], nA = [[0.5, 0.5], [0.5, 0.5]], nE = [[[0.5, 0.5, 0.5], [0.5, 0.5, 0.5]], [[0.5, 0.5, 0.5], [0.5, 0.5, 0.5]]];
    for (const [, q] of S) {
      const { al, c } = forward(q, pi, A, E), T = q.length, be: number[][] = Array.from({ length: T }, () => [1, 1]);
      for (let t = T - 2; t >= 0; t--) for (let j = 0; j < 2; j++) be[t][j] = (A[j][0] * E[0][q[t + 1].v][q[t + 1].r] * be[t + 1][0] + A[j][1] * E[1][q[t + 1].v][q[t + 1].r] * be[t + 1][1]) / c[t + 1];
      for (let t = 0; t < T; t++) { const g = [al[t][0] * be[t][0], al[t][1] * be[t][1]], gs = g[0] + g[1] || 1e-12; for (let k = 0; k < 2; k++) { const gk = g[k] / gs; if (t === 0) nPi[k] += gk; nE[k][q[t].v][q[t].r] += gk;
        if (t < T - 1) for (let j = 0; j < 2; j++) nA[k][j] += al[t][k] * A[k][j] * E[j][q[t + 1].v][q[t + 1].r] * be[t + 1][j] / c[t + 1]; } }
    }
    pi = nPi.map(v => v / (nPi[0] + nPi[1])); A = nA.map(r => r.map(v => v / (r[0] + r[1]))); E = nE.map(sv => sv.map(r => { const s = r[0] + r[1] + r[2]; return r.map(v => v / s); }));
  }
  const next = new Map<string, number[]>(); for (const [t, q] of S) { const { al } = forward(q, pi, A, E), a = al[al.length - 1]; next.set(t, [a[0] * A[0][0] + a[1] * A[1][0], a[0] * A[0][1] + a[1] * A[1][1]]); }
  const res = (t: string, v: number) => { const n = next.get(t); return n ? [0, 1, 2].map(r => n[0] * E[0][v][r] + n[1] * E[1][v][r]) : null; };
  return { predict: (h, a) => { const rh = res(h, 0), ra = res(a, 1); return rh && ra ? asProbs([(rh[0] + ra[2]) / 2, (rh[1] + ra[1]) / 2, (rh[2] + ra[0]) / 2]) : null; } };
} };

/** Kalman filter on team strength, with an optional trend. Observation: goal margin minus the average home margin. */
interface KS { L: number; B: number; p00: number; p01: number; p11: number; t: number }
function kalman(id: string, name: string, about: string, o: { trend: boolean; q: number; qb: number; R: number }): Model {
  return { id, name, family: "state-space", about, fit: (hist): FittedModel | null => {
    const st = new Map<string, KS>(), rows: { d: number; y: 0 | 1 | 2 }[] = [], s = byDate(hist); if (s.length < 60) return null; let sum = 0, n = 0;
    const get = (t: string, at: number) => { let k = st.get(t); if (!k) { k = { L: 0, B: 0, p00: 1, p01: 0, p11: 0.01, t: at }; st.set(t, k); }
      const dt = (at - k.t) / DAY / 30; if (dt > 0) { if (o.trend) { k.L += k.B * dt; k.p00 += 2 * dt * k.p01 + dt * dt * k.p11 + o.q * dt; k.p01 += dt * k.p11; k.p11 += o.qb * dt; } else k.p00 += o.q * dt; k.t = at; } return k; };
    for (const m of s) {
      const at = Date.parse(m.date), h = get(m.home, at), a = get(m.away, at), hfa = n ? sum / n : 0.3; rows.push({ d: h.L - a.L, y: outcomeIdx(m.hg, m.ag) });
      const S2 = h.p00 + a.p00 + o.R, r = m.hg - m.ag - hfa - (h.L - a.L);
      for (const [k, sg] of [[h, 1], [a, -1]] as [KS, number][]) { const p0 = k.p00, p1 = k.p01; k.L += sg * p0 / S2 * r; k.B += sg * p1 / S2 * r; k.p00 -= p0 * p0 / S2; k.p01 -= p0 * p1 / S2; k.p11 -= p1 * p1 / S2; }
      sum += m.hg - m.ag; n++;
    }
    const ord = fitOrdered(rows.slice(Math.floor(rows.length * 0.15))); if (!ord) return null;
    return { predict: (h, a) => { const x = st.get(h), y = st.get(a); return x && y ? ord(x.L - y.L) : null; } };
  } };
}
/** 77. Kalman filter team strength. */ export const kalmanStrength = kalman("kalman-strength", "Kalman Filter Team-Strength Model", "Team strength drifts as a random walk and is updated after every match.", { trend: false, q: 0.03, qb: 0, R: 2.2 });
/** 78. Dynamic linear model: strength plus a trend, so a rising or falling team is followed. */ export const dlmTrend = kalman("dlm-trend", "Dynamic Linear Model", "Team strength with a local trend component, updated after every match.", { trend: true, q: 0.02, qb: 0.003, R: 2.2 });

/** 89. Matrix factorisation of team style: low rank attack and defence style vectors, fitted by Poisson gradient steps on top of the strength model. */
export const matrixFactor: Model = { id: "matrix-factorisation", name: "Matrix Factorisation Team-Style Model", family: "machine-learning", about: "Two dimensional attack and defence style vectors adjust the strength based goal rates.", fit: (hist, now): FittedModel | null => {
  const s = fitStrengths(hist, now, 300); if (!s) return null; const teams = [...s.att.keys()], R = 2, rand = rng(89), U = new Map(teams.map(t => [t, [0, 1].map(() => (rand() - 0.5) * 0.1)])), V = new Map(teams.map(t => [t, [0, 1].map(() => (rand() - 0.5) * 0.1)]));
  const obs = hist.flatMap(m => { const l = lambdas(s, m.home, m.away); return l ? [{ a: m.home, d: m.away, y: m.hg, l: l.lh }, { a: m.away, d: m.home, y: m.ag, l: l.la }] : []; });
  for (let ep = 0; ep < 40; ep++) for (let n = 0; n < obs.length; n++) { const o = obs[Math.floor(rand() * obs.length)], u = U.get(o.a)!, v = V.get(o.d)!, z = Math.max(-0.6, Math.min(0.6, u[0] * v[0] + u[1] * v[1])), g = o.l * Math.exp(z) - o.y;
    for (let r = 0; r < R; r++) { const ur = u[r], vr = v[r]; u[r] -= 0.01 * (g * vr + 0.05 * ur); v[r] -= 0.01 * (g * ur + 0.05 * vr); } }
  const adj = (a: string, d: string) => { const u = U.get(a), v = V.get(d); return u && v ? Math.exp(Math.max(-0.6, Math.min(0.6, u[0] * v[0] + u[1] * v[1]))) : 1; };
  return { predict: (h, a) => { const l = lambdas(s, h, a); if (!l) return null; const lh = clampL(l.lh * adj(h, a)), la = clampL(l.la * adj(a, h)); return fromMatrix(matrixFrom((x, y) => poissonPmf(x, lh) * poissonPmf(y, la)), lh, la); } };
} };
