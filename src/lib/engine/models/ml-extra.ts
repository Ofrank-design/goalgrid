import type { FittedModel, Model, Probs } from "../../../types/prediction";
import { buildFeatures, featureExt, type Row, type State } from "./features";
import { hashStr, normCdf, normPdf, randn, rng, softmax } from "./math";
const P = (p: number[]): Probs => ({ home: p[0], draw: p[1], away: p[2] });
const MIN_ROWS = 150;
/** Shared plumbing: build leak free rows, fit a classifier on extended features, answer with probabilities. */
export function classifier(id: string, name: string, family: Model["family"], train: (rows: Row[], state: State) => ((xe: number[], key: string) => number[]) | null, heavy = false): Model {
  return { id, name, family, heavy, fit: (hist): FittedModel | null => {
    const { rows, state } = buildFeatures(hist); if (rows.length < MIN_ROWS) return null; const f = train(rows, state); if (!f) return null;
    return { predict: (h, a, ctx) => { const e = featureExt(state, h, a, ctx?.kickoffUtc ? Date.parse(ctx.kickoffUtc) : null); if (!e) return null; const p = f(e.xe, h + "|" + a); return p.every(Number.isFinite) ? P(p) : null; } };
  } };
}
export const stats = (rows: Row[]) => { const F = rows[0].xe.length, m = new Array(F).fill(0), s = new Array(F).fill(0); for (const r of rows) r.xe.forEach((v, j) => (m[j] += v / rows.length)); for (const r of rows) r.xe.forEach((v, j) => (s[j] += (v - m[j]) ** 2 / rows.length)); return { m, s: s.map(v => Math.sqrt(v) || 1) }; };
export const norm = (x: number[], st: { m: number[]; s: number[] }) => x.map((v, j) => (v - st.m[j]) / st.s[j]);
/** 30. Multinomial Naive Bayes on binned features. */
export const naiveBayes = classifier("naive-bayes", "Multinomial Naive Bayes", "machine-learning", rows => {
  const F = rows[0].xe.length, B = 5, cuts = Array.from({ length: F }, (_, j) => { const v = rows.map(r => r.xe[j]).sort((a, b) => a - b); return Array.from({ length: B - 1 }, (_, q) => v[Math.floor((q + 1) * v.length / B)]); });
  const bin = (x: number, c: number[]) => c.filter(t => x > t).length, cnt = Array.from({ length: 3 }, () => Array.from({ length: F }, () => new Array(B).fill(1))), prior = [3, 3, 3];
  for (const r of rows) { prior[r.y]++; r.xe.forEach((v, j) => cnt[r.y][j][bin(v, cuts[j])]++); }
  const lpOf = (xe: number[]) => [0, 1, 2].map(k => Math.log(prior[k]) + xe.reduce((s, v, j) => s + Math.log(cnt[k][j][bin(v, cuts[j])] / cnt[k][j].reduce((a, b) => a + b, 0)), 0));
  // Naive Bayes is overconfident when features overlap, so one temperature is fitted on the training rows.
  const L = rows.map(r => lpOf(r.xe)); let bT = 1, bl = Infinity; for (const T of [1, 1.5, 2, 3, 4, 6, 8, 12]) { let l = 0; L.forEach((lp, i) => (l -= Math.log(Math.max(softmax(lp.map(v => v / T))[rows[i].y], 1e-9)))); if (l < bl) { bl = l; bT = T; } }
  return xe => softmax(lpOf(xe).map(v => v / bT));
});
/** 34. k-Nearest Neighbours: the most similar past matches vote, nearer ones count for more. */
export const knn = classifier("knn", "k-Nearest Neighbours", "machine-learning", rows => {
  const st = stats(rows), Z = rows.map(r => norm(r.xe, st)), k = Math.min(35, Math.floor(rows.length / 8));
  return xe => { const z = norm(xe, st), d = Z.map((q, i) => ({ i, d: Math.sqrt(q.reduce((s, v, j) => s + (v - z[j]) ** 2, 0)) })).sort((a, b) => a.d - b.d).slice(0, k), c = [1, 1, 1]; for (const n of d) c[rows[n.i].y] += 1 / (n.d + 0.3); const s = c[0] + c[1] + c[2]; return c.map(v => v / s); };
});
interface Node { f?: number; t?: number; l?: Node; r?: Node; p?: number[] }
function grow(X: number[][], y: number[], idx: number[], depth: number, o: { maxD: number; minLeaf: number; mtry: number; extra: boolean; rand: () => number }): Node {
  const counts = [0, 0, 0]; for (const i of idx) counts[y[i]]++; const n = idx.length, leaf = (): Node => ({ p: counts.map(c => (c + 1) / (n + 3)) });
  if (depth >= o.maxD || n < 2 * o.minLeaf || counts.some(c => c === n)) return leaf();
  const F = X[0].length, feats = [...Array(F).keys()].sort(() => o.rand() - 0.5).slice(0, o.mtry), gini = (c: number[], m: number) => 1 - c.reduce((s, v) => s + (v / m) ** 2, 0);
  let best: { f: number; t: number; g: number } | null = null;
  for (const f of feats) { const v = idx.map(i => X[i][f]).sort((a, b) => a - b); let cand: number[]; if (o.extra) { if (v[0] === v[n - 1]) continue; cand = [v[0] + o.rand() * (v[n - 1] - v[0])]; } else cand = [1, 2, 3, 4, 5, 6, 7].map(q => v[Math.floor(q * n / 8)]);
    for (const t of cand) { const l = [0, 0, 0]; let nl = 0; for (const i of idx) if (X[i][f] <= t) { l[y[i]]++; nl++; } const nr = n - nl; if (nl < o.minLeaf || nr < o.minLeaf) continue; const r = counts.map((c, k) => c - l[k]), g = gini(counts, n) - nl / n * gini(l, nl) - nr / n * gini(r, nr); if (!best || g > best.g) best = { f, t, g }; } }
  if (!best || best.g <= 1e-9) return leaf(); const L = idx.filter(i => X[i][best!.f] <= best!.t), R = idx.filter(i => X[i][best!.f] > best!.t);
  return { f: best.f, t: best.t, l: grow(X, y, L, depth + 1, o), r: grow(X, y, R, depth + 1, o) };
}
const walk = (n: Node, x: number[]): number[] => (n.p ? n.p : x[n.f!] <= n.t! ? walk(n.l!, x) : walk(n.r!, x));
const forest = (id: string, name: string, extra: boolean) => classifier(id, name, "machine-learning", rows => {
  const X = rows.map(r => r.xe), y = rows.map(r => r.y), rand = rng(hashStr(id)), trees: Node[] = [];
  for (let t = 0; t < 40; t++) { const idx = extra ? rows.map((_, i) => i) : rows.map(() => Math.floor(rand() * rows.length)); trees.push(grow(X, y, idx, 0, { maxD: 4, minLeaf: 10, mtry: 3, extra, rand })); }
  return xe => { const a = [0, 0, 0]; for (const t of trees) walk(t, xe).forEach((v, k) => (a[k] += v / trees.length)); return a; };
});
/** 31. Random Forest. */ export const randomForest = forest("random-forest", "Random Forest Classifier", false);
/** 32. Extra Trees: random split points, no bootstrap. */ export const extraTrees = forest("extra-trees", "Extra Trees Classifier", true);
/** 33. Support Vector Machine: one against rest linear SVMs (Pegasos) on second order features, with a fitted temperature for probabilities. */
const poly = (z: number[]) => { const o = [...z, 1]; for (let i = 0; i < 3; i++) o.push(z[i] * Math.abs(z[i])); return o; };
export const svm = classifier("svm", "Support Vector Machine", "machine-learning", rows => {
  const st = stats(rows), X = rows.map(r => poly(norm(r.xe, st))), D = X[0].length, lam = 0.1, rand = rng(7), W = [0, 1, 2].map(() => new Array(D).fill(0)); let t = 0;
  for (let ep = 0; ep < 25; ep++) for (let n = 0; n < rows.length; n++) { const i = Math.floor(rand() * rows.length); t++; const eta = 1 / (lam * t); for (let k = 0; k < 3; k++) { const yy = rows[i].y === k ? 1 : -1, mg = yy * W[k].reduce((s, w, j) => s + w * X[i][j], 0); for (let j = 0; j < D; j++) W[k][j] *= 1 - eta * lam; if (mg < 1) for (let j = 0; j < D; j++) W[k][j] += eta * yy * X[i][j]; } }
  const dec = (x: number[]) => W.map(w => w.reduce((s, v, j) => s + v * x[j], 0)), D0 = X.map(dec);
  let bT = 1, bl = Infinity; for (const T of [0.01, 0.02, 0.05, 0.1, 0.25, 0.5, 1, 2]) { let l = 0; D0.forEach((d, i) => (l -= Math.log(Math.max(softmax(d.map(v => v * T))[rows[i].y], 1e-9)))); if (l < bl) { bl = l; bT = T; } }
  return xe => softmax(dec(poly(norm(xe, st))).map(v => v * bT));
});
/** 35. Multinomial Probit with independent errors: choice probabilities by numerical integration, weights found by coordinate search. */
export const probit = classifier("multinomial-probit", "Multinomial Probit", "machine-learning", rows => {
  const sub = rows.filter((_, i) => i % 2 === 0), st = stats(rows), Z = sub.map(r => [...norm(r.xe, st), 1]), F = Z[0].length, grid: [number, number][] = []; for (let t = -4; t <= 4.001; t += 0.3) grid.push([t, normPdf(t) * 0.3]);
  const probs = (w: number[], z: number[]) => { const mu = [w.slice(0, F).reduce((s, v, j) => s + v * z[j], 0), 0, w.slice(F).reduce((s, v, j) => s + v * z[j], 0)], p = [0, 0, 0]; for (let k = 0; k < 3; k++) for (const [t, d] of grid) { let pr = d; for (let j = 0; j < 3; j++) if (j !== k) pr *= normCdf(t + mu[k] - mu[j]); p[k] += pr; } const s = p[0] + p[1] + p[2]; return p.map(v => v / s); };
  const nll = (w: number[]) => { let l = 0; Z.forEach((z, i) => (l -= Math.log(Math.max(probs(w, z)[sub[i].y], 1e-9)))); return l + 25 * w.reduce((s, v) => s + v * v, 0); };
  const w = new Array(2 * F).fill(0); let best = nll(w), step = 0.4;
  for (let it = 0; it < 30 && step > 0.02; it++) { let moved = false; for (let j = 0; j < w.length; j++) for (const d of [step, -step]) { w[j] += d; const v = nll(w); if (v < best) { best = v; moved = true; } else w[j] -= d; } if (!moved) step /= 2; }
  return xe => probs(w, [...norm(xe, st), 1]);
}, true);
/** Softmax regression with L2, shared by the Bayesian logistic model. */
export function softmaxFit(X: number[][], y: number[], epochs: number, lr: number, l2: number) {
  const F = X[0].length, W = [0, 1, 2].map(() => new Array(F).fill(0));
  for (let ep = 0; ep < epochs; ep++) { const g = [0, 1, 2].map(() => new Array(F).fill(0)); X.forEach((x, i) => { const p = softmax(W.map(w => w.reduce((s, v, j) => s + v * x[j], 0))); for (let k = 0; k < 3; k++) { const e = p[k] - (y[i] === k ? 1 : 0); for (let j = 0; j < F; j++) g[k][j] += e * x[j]; } }); for (let k = 0; k < 3; k++) for (let j = 0; j < F; j++) W[k][j] -= lr * (g[k][j] / X.length + l2 * W[k][j]); }
  return W;
}
/** 36. Bayesian Logistic Regression: a Laplace (diagonal) approximation to the weight posterior, predictions averaged over posterior draws. */
export const bayesLogit = classifier("bayes-logistic", "Bayesian Logistic Regression", "bayesian", rows => {
  const st = stats(rows), X = rows.map(r => [...norm(r.xe, st), 1]), y = rows.map(r => r.y), l2 = 0.01, W = softmaxFit(X, y, 250, 0.5, l2), F = X[0].length;
  const sd = W.map((_, k) => Array.from({ length: F }, (_, j) => { let h = l2 * X.length; X.forEach(x => { const p = softmax(W.map(w => w.reduce((s, v, q) => s + v * x[q], 0)))[k]; h += x[j] * x[j] * p * (1 - p); }); return 1 / Math.sqrt(h); }));
  return (xe, key) => { const z = [...norm(xe, st), 1], r = rng(hashStr(key)), a = [0, 0, 0], S = 60; for (let s = 0; s < S; s++) { const p = softmax(W.map((w, k) => w.reduce((t, v, j) => t + (v + sd[k][j] * randn(r)) * z[j], 0))); for (let k = 0; k < 3; k++) a[k] += p[k] / S; } return a; };
});
/** Boosted trees on softmax gradients and hessians. Three growth strategies stand in for three well known libraries. */
type Grow = "level" | "leaf" | "oblivious";
function boost(X: number[][], y: number[], o: { rounds: number; lr: number; lam: number; grow: Grow; depth: number; leaves: number; minH: number; gamma: number }) {
  const n = X.length, F = X[0].length, cuts = Array.from({ length: F }, (_, j) => { const v = [...new Set(X.map(x => x[j]))].sort((a, b) => a - b); return Array.from({ length: 10 }, (_, q) => v[Math.floor((q + 1) * v.length / 11)]).filter((c, i, a) => c !== undefined && a.indexOf(c) === i); });
  const S = X.map(() => [0, 0, 0]), forest: ((x: number[]) => number)[][] = [[], [], []];
  const gainOf = (G: number, H: number, GL: number, HL: number) => GL * GL / (HL + o.lam) + (G - GL) ** 2 / (H - HL + o.lam) - G * G / (H + o.lam) - o.gamma;
  for (let r = 0; r < o.rounds; r++) {
    const Pm = S.map(softmax);
    for (let k = 0; k < 3; k++) {
      const g = X.map((_, i) => Pm[i][k] - (y[i] === k ? 1 : 0)), h = X.map((_, i) => Math.max(Pm[i][k] * (1 - Pm[i][k]), 1e-6)), sum = (ids: number[]) => ids.reduce((a, i) => [a[0] + g[i], a[1] + h[i]], [0, 0]);
      const bestSplit = (ids: number[]) => { const [G, H] = sum(ids); let b: { f: number; t: number; gain: number } | null = null; for (let f = 0; f < F; f++) for (const t of cuts[f]) { let GL = 0, HL = 0; for (const i of ids) if (X[i][f] <= t) { GL += g[i]; HL += h[i]; } if (HL < o.minH || H - HL < o.minH) continue; const gn = gainOf(G, H, GL, HL); if (!b || gn > b.gain) b = { f, t, gain: gn }; } return b; };
      const val = (ids: number[]) => { const [G, H] = sum(ids); return -o.lr * G / (H + o.lam); };
      let tree: (x: number[]) => number; const all = X.map((_, i) => i);
      if (o.grow === "level") { const build = (ids: number[], d: number): Node & { v?: number } => { const b = d < o.depth ? bestSplit(ids) : null; if (!b || b.gain <= 0) return { v: val(ids) }; return { f: b.f, t: b.t, l: build(ids.filter(i => X[i][b.f] <= b.t), d + 1), r: build(ids.filter(i => X[i][b.f] > b.t), d + 1) }; }; const root = build(all, 0); const w = (nd: Node & { v?: number }, x: number[]): number => (nd.v !== undefined ? nd.v : x[nd.f!] <= nd.t! ? w(nd.l!, x) : w(nd.r!, x)); tree = x => w(root, x); }
      else if (o.grow === "leaf") { const root: Node & { v?: number } = { v: val(all) }; let leaves = [{ nd: root, ids: all, b: bestSplit(all) }];
        while (leaves.length < o.leaves) { const c = leaves.filter(l => l.b && l.b.gain > 0).sort((a, b) => b.b!.gain - a.b!.gain)[0]; if (!c) break; const b = c.b!, L = c.ids.filter(i => X[i][b.f] <= b.t), R = c.ids.filter(i => X[i][b.f] > b.t), ln: Node & { v?: number } = { v: val(L) }, rn: Node & { v?: number } = { v: val(R) }; c.nd.v = undefined; c.nd.f = b.f; c.nd.t = b.t; c.nd.l = ln; c.nd.r = rn; leaves = leaves.filter(l => l !== c); leaves.push({ nd: ln, ids: L, b: bestSplit(L) }, { nd: rn, ids: R, b: bestSplit(R) }); }
        const w = (nd: Node & { v?: number }, x: number[]): number => (nd.v !== undefined ? nd.v : x[nd.f!] <= nd.t! ? w(nd.l!, x) : w(nd.r!, x)); tree = x => w(root, x); }
      else { let groups = [all]; const splits: { f: number; t: number }[] = [];
        for (let d = 0; d < o.depth; d++) { let b: { f: number; t: number; gain: number } | null = null; for (let f = 0; f < F; f++) for (const t of cuts[f]) { let tot = 0, ok = true; for (const ids of groups) { if (!ids.length) continue; const [G, H] = sum(ids); let GL = 0, HL = 0; for (const i of ids) if (X[i][f] <= t) { GL += g[i]; HL += h[i]; } if (HL < 1e-9 && H - HL < 1e-9) { ok = false; break; } tot += gainOf(G, H, GL, HL); } if (ok && (!b || tot > b.gain)) b = { f, t, gain: tot }; }
          if (!b || b.gain <= 0) break; splits.push({ f: b.f, t: b.t }); groups = groups.flatMap(ids => [ids.filter(i => X[i][b!.f] <= b!.t), ids.filter(i => X[i][b!.f] > b!.t)]); }
        const vals = groups.map(ids => (ids.length ? val(ids) : 0)); tree = x => { let id = 0; for (const s of splits) id = id * 2 + (x[s.f] <= s.t ? 0 : 1); return vals[id]; }; }
      forest[k].push(tree); for (let i = 0; i < n; i++) S[i][k] += tree(X[i]);
    }
  }
  return (x: number[]) => softmax(forest.map(t => t.reduce((s, f) => s + f(x), 0)));
}
const booster = (id: string, name: string, o: Parameters<typeof boost>[2]) => classifier(id, name, "machine-learning", rows => { const f = boost(rows.map(r => r.xe), rows.map(r => r.y), o); return xe => f(xe); }, true);
/** 37. CatBoost style: symmetric (oblivious) trees. In-house implementation of the method, not the CatBoost library. */
export const catBoost = booster("catboost-style", "CatBoost Classifier", { rounds: 40, lr: 0.1, lam: 3, grow: "oblivious", depth: 3, leaves: 8, minH: 0.5, gamma: 0 });
/** 38. LightGBM style: leaf wise growth on histogram cuts. In-house implementation of the method, not the LightGBM library. */
export const lightGbm = booster("lightgbm-style", "LightGBM Classifier", { rounds: 40, lr: 0.1, lam: 1, grow: "leaf", depth: 6, leaves: 8, minH: 4, gamma: 0 });
/** 39. XGBoost style: level wise trees with second order gain and regularisation. In-house implementation of the method, not the XGBoost library. */
export const xgBoost = booster("xgboost-style", "XGBoost Classifier", { rounds: 40, lr: 0.1, lam: 2, grow: "level", depth: 3, leaves: 8, minH: 2, gamma: 0.5 });
