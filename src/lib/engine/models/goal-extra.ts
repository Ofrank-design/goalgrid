import type { FittedModel, HistMatch, Model, ModelFamily, ModelOutput } from "../../../types/prediction";
import { MAXG, hashStr, lgamma, matrixFrom, poissonPmf, probsFromMatrix, randn, rng } from "./math";
import { fitStrengths, lambdas, type Strengths } from "./strengths";
const clampL = (x: number) => Math.min(Math.max(x, 0.15), 4.5);
const out = (m: number[][], lh: number, la: number): ModelOutput => ({ ...probsFromMatrix(m), lambdaHome: lh, lambdaAway: la, matrix: m });
const obs = (s: Strengths, hist: HistMatch[]) => hist.flatMap(m => { const l = lambdas(s, m.home, m.away); return l ? [{ k: m.hg, mu: l.lh }, { k: m.ag, mu: l.la }] : []; });
const argmax = (xs: number[], f: (x: number) => number) => xs.reduce((b, x) => (f(x) > f(b) ? x : b), xs[0]);
/** A goal count distribution model: team means come from time weighted strengths, the pmf shape is fitted from history. */
function pmfModel(id: string, name: string, family: ModelFamily, halfLife: number, shape: (obs: { k: number; mu: number }[]) => (mu: number) => number[]): Model {
  return { id, name, family, fit: (hist, now): FittedModel | null => {
    const s = fitStrengths(hist, now, halfLife); if (!s) return null; const pmf = shape(obs(s, hist));
    return { predict: (h, a) => { const l = lambdas(s, h, a); if (!l) return null; const lh = clampL(l.lh), la = clampL(l.la), ph = pmf(lh), pa = pmf(la); return out(matrixFrom((x, y) => ph[x] * pa[y]), lh, la); } };
  } };
}
const pois = (mu: number) => Array.from({ length: MAXG + 1 }, (_, k) => poissonPmf(k, mu));
/** 10. Zero-inflated Poisson: an extra chance of a blank, fitted on the share of 0 goal games. */
const zipPmf = (mu: number, pi: number) => { const m = mu / (1 - pi); return pois(m).map((p, k) => (k === 0 ? pi + (1 - pi) * p : (1 - pi) * p)); };
const fitZip = (o: { k: number; mu: number }[]) => argmax(Array.from({ length: 31 }, (_, i) => i * 0.005), pi => o.reduce((s, x) => { const m = x.mu / (1 - pi), p = poissonPmf(x.k, m); return s + Math.log(Math.max(x.k === 0 ? pi + (1 - pi) * p : (1 - pi) * p, 1e-12)); }, 0));
export const zeroInflated = pmfModel("zero-inflated-poisson", "Zero-Inflated Poisson", "goals", 300, o => { const pi = fitZip(o); return mu => zipPmf(mu, pi); });
/** 11. Hurdle Poisson: one part decides whether a team scores, a zero truncated Poisson decides how many. */
export const hurdle = pmfModel("hurdle-poisson", "Hurdle Poisson", "goals", 300, o => {
  const phi = Math.min(Math.max(o.filter(x => x.k === 0).length / Math.max(o.reduce((s, x) => s + Math.exp(-x.mu), 0), 1e-9), 0.7), 1.3);
  return mu => { const p0 = Math.min(Math.max(phi * Math.exp(-mu), 0.02), 0.95); let lo = 0.01, hi = 20; for (let i = 0; i < 40; i++) { const v = (lo + hi) / 2; if ((1 - p0) * v / (1 - Math.exp(-v)) < mu) lo = v; else hi = v; }
    const v = (lo + hi) / 2, base = pois(v), z = 1 - Math.exp(-v); return base.map((p, k) => (k === 0 ? p0 : (1 - p0) * p / z)); };
});
/** 12. Generalized Poisson (Consul): a dispersion parameter from the variance to mean ratio. */
export const generalizedPoisson = pmfModel("generalized-poisson", "Generalized Poisson", "goals", 300, o => {
  const d = o.reduce((s, x) => s + (x.k - x.mu) ** 2, 0) / Math.max(o.reduce((s, x) => s + x.mu, 0), 1e-9), lam = Math.min(Math.max(1 - 1 / Math.sqrt(Math.max(d, 0.5)), -0.2), 0.5);
  return mu => { const th = mu * (1 - lam); return Array.from({ length: MAXG + 1 }, (_, k) => { const t = th + k * lam; return t > 0 ? Math.exp(Math.log(th) + (k > 1 ? (k - 1) * Math.log(t) : k === 1 ? 0 : -Math.log(t)) - t - lgamma(k + 1)) : 0; }); };
});
/** 13. Conway-Maxwell-Poisson: a nu parameter covers both over and under dispersed goal counts. */
const comPmf = (mu: number, nu: number) => { const K = 30; const w = (l: number) => { const t: number[] = []; let s = 0; for (let k = 0; k < K; k++) { const v = Math.exp(k * Math.log(l) - nu * lgamma(k + 1)); t.push(v); s += v; } return t.map(v => v / s); };
  let lo = 1e-4, hi = 60; for (let i = 0; i < 40; i++) { const m = (lo + hi) / 2, p = w(m), e = p.reduce((s, v, k) => s + k * v, 0); if (e < mu) lo = m; else hi = m; } return w((lo + hi) / 2).slice(0, MAXG + 1); };
export const conwayMaxwell = pmfModel("conway-maxwell-poisson", "Conway-Maxwell-Poisson", "goals", 300, o => {
  const sub = o.filter((_, i) => i % 3 === 0), nu = argmax([0.7, 0.8, 0.9, 1, 1.1, 1.2, 1.3], n => sub.reduce((s, x) => s + Math.log(Math.max(comPmf(x.mu, n)[Math.min(x.k, MAXG)] ?? 1e-9, 1e-9)), 0));
  return mu => comPmf(mu, nu);
});
/** 20. Home and away split strengths: each team gets its own home and away attack and defence adjustments. */
export const homeAwaySplit: Model = { id: "home-away-split", name: "Home/Away Split Strength Model", family: "goals", fit: (hist, now): FittedModel | null => {
  const s = fitStrengths(hist, now, 300); if (!s) return null; const K = 6, adj = new Map<string, { ah: number; aa: number; dh: number; da: number }>();
  const acc = new Map<string, number[]>(); const add = (t: string, i: number, v: number) => { const a = acc.get(t) ?? [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]; a[i] += v; acc.set(t, a); };
  for (const m of hist) { const l = lambdas(s, m.home, m.away); if (!l) continue; add(m.home, 0, m.hg); add(m.home, 1, l.lh); add(m.home, 2, m.ag); add(m.home, 3, l.la); add(m.home, 4, 1); add(m.away, 5, m.ag); add(m.away, 6, l.la); add(m.away, 7, m.hg); add(m.away, 8, l.lh); add(m.away, 9, 1); }
  for (const [t, a] of acc) { const shr = (num: number, den: number, n: number) => (num + K * 1) / (den + K * 1) * 1 * (n > 0 ? 1 : 1);
    adj.set(t, { ah: shr(a[0], a[1], a[4]), dh: shr(a[2], a[3], a[4]), aa: shr(a[5], a[6], a[9]), da: shr(a[7], a[8], a[9]) }); }
  return { predict: (h, a) => { const l = lambdas(s, h, a), ah = adj.get(h), aw = adj.get(a); if (!l || !ah || !aw) return null;
    const lh = clampL(l.lh * ah.ah * aw.da), la = clampL(l.la * aw.aa * ah.dh); return out(matrixFrom((x, y) => poissonPmf(x, lh) * poissonPmf(y, la)), lh, la); } };
} };
/** 23. Rolling attack and defence index over each team's last eight matches. */
export const rollingIndex: Model = { id: "rolling-index", name: "Rolling Attack/Defence Index", family: "goals", fit: hist => {
  if (hist.length < 30) return null; const sorted = [...hist].sort((a, b) => a.date.localeCompare(b.date)), N = 8, last = new Map<string, [number, number][]>();
  let g = 0, muH = 0, muA = 0; for (const m of sorted) { g += m.hg + m.ag; muH += m.hg; muA += m.ag; const push = (t: string, gf: number, ga: number) => { const a = last.get(t) ?? []; a.push([gf, ga]); if (a.length > N) a.shift(); last.set(t, a); }; push(m.home, m.hg, m.ag); push(m.away, m.ag, m.hg); }
  const avg = g / (2 * sorted.length); muH /= sorted.length; muA /= sorted.length;
  const idx = (t: string) => { const a = last.get(t); if (!a || a.length < 3) return null; const P = 2; return { att: (a.reduce((s, x) => s + x[0], 0) + P * avg) / ((a.length + P) * avg), def: (a.reduce((s, x) => s + x[1], 0) + P * avg) / ((a.length + P) * avg) }; };
  return { predict: (h, a) => { const ih = idx(h), ia = idx(a); if (!ih || !ia) return null; const lh = clampL(muH * ih.att * ia.def), la = clampL(muA * ia.att * ih.def); return out(matrixFrom((x, y) => poissonPmf(x, lh) * poissonPmf(y, la)), lh, la); } };
} };
/** Online log strengths: after every match each team moves a little toward what it just showed, and old information fades. */
function dynamicState(hist: HistMatch[], eta = 0.06, fade = 0.997) {
  const s = [...hist].sort((a, b) => a.date.localeCompare(b.date)), n = s.length || 1, muH = Math.log(Math.max(s.reduce((a, m) => a + m.hg, 0) / n, 0.1)), muA = Math.log(Math.max(s.reduce((a, m) => a + m.ag, 0) / n, 0.1));
  const att = new Map<string, number>(), def = new Map<string, number>(), pre: { date: string; hg: number; ag: number; lh: number; la: number }[] = [];
  const get = (m: Map<string, number>, t: string) => m.get(t) ?? 0;
  for (const m of s) {
    const lh = Math.exp(muH + get(att, m.home) - get(def, m.away)), la = Math.exp(muA + get(att, m.away) - get(def, m.home)); pre.push({ date: m.date, hg: m.hg, ag: m.ag, lh, la });
    const eh = m.hg - lh, ea = m.ag - la;
    att.set(m.home, get(att, m.home) * fade + eta * eh); def.set(m.away, get(def, m.away) * fade - eta * eh); att.set(m.away, get(att, m.away) * fade + eta * ea); def.set(m.home, get(def, m.home) * fade - eta * ea);
  }
  return { att, def, muH, muA, pre, lam: (h: string, a: string) => (att.has(h) && att.has(a) ? { lh: clampL(Math.exp(muH + get(att, h) - get(def, a))), la: clampL(Math.exp(muA + get(att, a) - get(def, h))) } : null) };
}
/** 15. Dynamic Poisson. */
export const dynamicPoisson: Model = { id: "dynamic-poisson", name: "Dynamic Poisson", family: "goals", fit: hist => {
  if (hist.length < 30) return null; const d = dynamicState(hist);
  return { predict: (h, a) => { const l = d.lam(h, a); return l ? out(matrixFrom((x, y) => poissonPmf(x, l.lh) * poissonPmf(y, l.la)), l.lh, l.la) : null; } };
} };
const tau = (x: number, y: number, lh: number, la: number, rho: number) => x === 0 && y === 0 ? 1 - lh * la * rho : x === 0 && y === 1 ? 1 + lh * rho : x === 1 && y === 0 ? 1 + la * rho : x === 1 && y === 1 ? 1 - rho : 1;
/** 16. Dynamic Dixon-Coles: dynamic strengths, and the low score correction is estimated on the most recent months only. */
export const dynamicDixonColes: Model = { id: "dynamic-dixon-coles", name: "Dynamic Dixon-Coles", family: "goals", fit: hist => {
  if (hist.length < 60) return null; const d = dynamicState(hist), cutoff = Date.parse(d.pre[d.pre.length - 1].date) - 150 * 86_400_000, recent = d.pre.filter(p => Date.parse(p.date) >= cutoff && p.hg <= 1 && p.ag <= 1);
  let best = 0, bl = -Infinity; for (let r = -0.2; r <= 0.101; r += 0.01) { let ll = 0; for (const p of recent) { const t = tau(p.hg, p.ag, p.lh, p.la, r); if (t <= 0) { ll = -Infinity; break; } ll += Math.log(t); } if (ll > bl) { bl = ll; best = r; } }
  return { predict: (h, a) => { const l = d.lam(h, a); return l ? out(matrixFrom((x, y) => poissonPmf(x, l.lh) * poissonPmf(y, l.la) * tau(x, y, l.lh, l.la, best)), l.lh, l.la) : null; } };
} };
/** Bayesian models: team strengths are uncertain, so the forecast averages over draws from each team's posterior instead of using one point estimate. */
function bayes(id: string, name: string, shape: (hist: HistMatch[]) => (lh: number, la: number) => number[][], halfLife = 180): Model {
  return { id, name, family: "bayesian", fit: (hist, now) => {
    const s = fitStrengths(hist, now, halfLife, 6); if (!s) return null; const mk = shape(hist), eff = new Map<string, number>();
    for (const m of hist) { const w = Math.pow(0.5, Math.max(0, (now.getTime() - Date.parse(m.date)) / 86_400_000) / halfLife); eff.set(m.home, (eff.get(m.home) ?? 0) + w * m.hg); eff.set(m.away, (eff.get(m.away) ?? 0) + w * m.ag); }
    return { predict: (h, a) => { const base = lambdas(s, h, a); if (!base) return null; const r = rng(hashStr(h + "|" + a)), S = 48, sdH = 1 / Math.sqrt((eff.get(h) ?? 0) + 5), sdA = 1 / Math.sqrt((eff.get(a) ?? 0) + 5);
      const acc: number[][] = Array.from({ length: MAXG + 1 }, () => new Array(MAXG + 1).fill(0));
      for (let i = 0; i < S; i++) { const zh = randn(r), za = randn(r), lh = clampL(base.lh * Math.exp(sdH * zh - sdH * sdH / 2)), la = clampL(base.la * Math.exp(sdA * za - sdA * sdA / 2)), m = mk(lh, la); for (let x = 0; x <= MAXG; x++) for (let y = 0; y <= MAXG; y++) acc[x][y] += m[x][y] / S; }
      return out(acc, base.lh, base.la); } };
  } };
}
const bivMatrix = (l3: number) => (lh: number, la: number) => { const l1 = Math.max(lh - l3, 0.05), l2 = Math.max(la - l3, 0.05), fact = (n: number) => { let f = 1; for (let i = 2; i <= n; i++) f *= i; return f; }, ch = (n: number, k: number) => fact(n) / (fact(k) * fact(n - k));
  return matrixFrom((x, y) => { let s = 0; for (let k = 0; k <= Math.min(x, y); k++) s += ch(x, k) * ch(y, k) * fact(k) * Math.pow(l3 / (l1 * l2), k); return Math.exp(-(l1 + l2 + l3)) * Math.pow(l1, x) / fact(x) * Math.pow(l2, y) / fact(y) * s; }); };
/** 17. Dynamic Bayesian Hierarchical Poisson: partial pooling toward the league (strong shrinkage), a 180 day memory and posterior draws. */
export const bayesHierarchical = bayes("bayes-hierarchical-poisson", "Dynamic Bayesian Hierarchical Poisson", () => (lh, la) => matrixFrom((x, y) => poissonPmf(x, lh) * poissonPmf(y, la)));
/** 18. Bayesian Bivariate Poisson. */
export const bayesBivariate = bayes("bayes-bivariate-poisson", "Bayesian Bivariate Poisson", h => { const mh = h.reduce((a, m) => a + m.hg, 0) / h.length, ma = h.reduce((a, m) => a + m.ag, 0) / h.length; return bivMatrix(Math.min(Math.max(h.reduce((a, m) => a + (m.hg - mh) * (m.ag - ma), 0) / h.length, 0.001), 0.25)); });
/** 19. Bayesian Zero-Inflated Poisson. */
export const bayesZip = bayes("bayes-zero-inflated-poisson", "Bayesian Zero-Inflated Poisson", h => { const n = h.length, zeros = h.reduce((a, m) => a + (m.hg === 0 ? 1 : 0) + (m.ag === 0 ? 1 : 0), 0) / (2 * n), mu = h.reduce((a, m) => a + m.hg + m.ag, 0) / (2 * n), pi = Math.min(Math.max((zeros - Math.exp(-mu)) / (1 - Math.exp(-mu)), 0), 0.15);
  return (lh, la) => { const ph = zipPmf(lh, pi), pa = zipPmf(la, pi); return matrixFrom((x, y) => ph[x] * pa[y]); }; });
/** 21. Time-decay xG strengths. Runs only when the history carries expected goals. */
export const xgStrength: Model = { id: "time-decay-xg", name: "Time-Decay xG Strength Model", family: "goals", needs: "expected goals (xG) in the match history", fit: (hist, now) => {
  const x = hist.filter(m => m.hxg != null && m.axg != null); if (x.length < Math.max(60, hist.length * 0.8)) return null;
  const s = fitStrengths(x.map(m => ({ ...m, hg: m.hxg!, ag: m.axg! })), now, 120); if (!s) return null;
  return { predict: (h, a) => { const l = lambdas(s, h, a); if (!l) return null; const lh = clampL(l.lh), la = clampL(l.la); return out(matrixFrom((p, q) => poissonPmf(p, lh) * poissonPmf(q, la)), lh, la); } };
} };
export { dynamicState };
