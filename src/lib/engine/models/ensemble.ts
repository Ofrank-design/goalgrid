import type { FittedModel, HistMatch, Model, ModelMetric, Prediction, PredictCtx } from "../../../types/prediction";
import { GOAL_MODELS } from "./goal-models";
import { RATING_MODELS } from "./rating-models";
import { bayesBivariate, bayesHierarchical, bayesZip, conwayMaxwell, dynamicDixonColes, dynamicPoisson, generalizedPoisson, homeAwaySplit, hurdle, rollingIndex, xgStrength, zeroInflated } from "./goal-extra";
import { bradleyTerry, colley, expectedPoints, glicko2, massey, pageRank, skellam, trueSkill } from "./rating-extra";
import { bayesLogit, catBoost, extraTrees, knn, lightGbm, naiveBayes, probit, randomForest, svm, xgBoost } from "./ml-extra";
import { feedforward, lstm, tabNet, tcn, transformer } from "./nn-extra";
import { availability, lineupStrength, newsSentiment, restCongestion, tacticalMatchup, weatherVenue } from "./context-models";
import { elasticNet, gam, lda, ordinalLogistic, qda, rda } from "./ml-more";
import { betaBtts, betaOver, cleanSheet, dirichletForm, dlmTrend, hmmForm, kalmanStrength, matrixFactor } from "./form-models";
import { claytonCopula, frankCopula, gaussianCopula } from "./copula-models";
import { WAITING_MODELS } from "./specialist";
import { fitCalibrator, logLoss, type Calibrator } from "../calibration";
import { MAXG, normalize, outcomeIdx, softmax } from "./math";
import { GOALGRID_LIMITS } from "../../control/limits";
const [poisson, dixonColes, bivariatePoisson, negativeBinomial, recentForm] = GOAL_MODELS, [elo, logistic, boosted, marketModel] = RATING_MODELS;
/** The base model library: the original 50, then the history based additions and the registered-but-waiting models. Stacking and conformal prediction (99, 100) are ensemble components, not entries here. */
export const ALL_MODELS: Model[] = [poisson, dixonColes, bivariatePoisson, negativeBinomial, recentForm, elo, logistic, boosted, marketModel, zeroInflated, hurdle, generalizedPoisson, conwayMaxwell, skellam, dynamicPoisson, dynamicDixonColes, bayesHierarchical, bayesBivariate, bayesZip, homeAwaySplit, xgStrength, expectedPoints, rollingIndex, glicko2, trueSkill, pageRank, massey, colley, bradleyTerry, naiveBayes, randomForest, extraTrees, svm, knn, probit, bayesLogit, catBoost, lightGbm, xgBoost, feedforward, tabNet, tcn, lstm, transformer, availability, lineupStrength, tacticalMatchup, restCongestion, weatherVenue, newsSentiment,
  ordinalLogistic, lda, qda, rda, gam, elasticNet, dirichletForm, betaBtts, betaOver, cleanSheet, hmmForm, kalmanStrength, dlmTrend, frankCopula, claytonCopula, gaussianCopula, matrixFactor, ...WAITING_MODELS];
export interface StackFit { fams: string[]; theta: number[]; b: [number, number]; llStacked: number; llWeighted: number; n: number }
export interface ConformalFit { alpha: number; threshold: number; n: number; avgSetSize: number }
export interface Ensemble { fitted: { model: Model; fitted: FittedModel; weight: number; calibrate?: Calibrator }[]; waiting: { id: string; name: string; reason: string }[]; metrics: ModelMetric[]; games: Map<string, number>; historyMatches: number;
  builtAt: string; matrixIds: string[]; baselineLogLoss: number | null; stack: StackFit | null; conformal: ConformalFit | null }
const safe = <T,>(f: () => T): T | null => { try { return f(); } catch { return null; } };
const OUT = ["home", "draw", "away"] as const, r3 = (x: number) => Math.round(x * 1000) / 1000, DEGRADE_MARGIN = 0.03;
const pool = (fp: number[][], theta: number[], b: [number, number]) => softmax([0, 1, 2].map(k => fp.reduce((s, p, f) => s + theta[f] * Math.log(Math.max(p[k], 1e-6)), 0) + (k === 0 ? b[0] : k === 2 ? b[1] : 0)));
/** 99. Stacked meta learner: a logarithmic pool of family averages. Fitted only on predictions made for matches the base models had not seen. */
function fitPool(F: number[][][], y: number[]): { theta: number[]; b: [number, number] } {
  const nF = F[0].length, theta = new Array(nF).fill(1 / nF), b: [number, number] = [0, 0];
  for (let it = 0; it < 150; it++) { const gT = new Array(nF).fill(0), gB = [0, 0];
    F.forEach((fp, i) => { const p = pool(fp, theta, b); for (let k = 0; k < 3; k++) { const e = p[k] - (y[i] === k ? 1 : 0); for (let f = 0; f < nF; f++) gT[f] += e * Math.log(Math.max(fp[f][k], 1e-6)); if (k === 0) gB[0] += e; if (k === 2) gB[1] += e; } });
    for (let f = 0; f < nF; f++) theta[f] = Math.max(0, theta[f] - 0.3 * (gT[f] / F.length + 0.05 * (theta[f] - 1 / nF))); b[0] -= 0.3 * gB[0] / F.length; b[1] -= 0.3 * gB[1] / F.length; }
  return { theta, b };
}
const ll = (ps: number[][], y: number[]) => -ps.reduce((a, p, i) => a + Math.log(Math.max(p[y[i]], 1e-6)), 0) / Math.max(ps.length, 1);
/** Fits a bounded candidate set, scores eligible candidates on the most recent 20% of matches, then activates a resource-limited ensemble.
 *  A model that does worse than plain base rates on those matches is marked degraded and gets no weight. Models that cannot be validated (market, priors, data feeds) are capped at half the average weight.
 *  Every family is damped by the square root of its size so no family drowns the others. */
export function buildEnsemble(history: HistMatch[], now = new Date()): Ensemble {
  const h = [...history].sort((a, b) => a.date.localeCompare(b.date)), cut = Math.floor(h.length * 0.8), canTest = h.length >= 150;
  const raw = new Map<string, { ll: number; br: number; n: number }>(), trainFits = new Map<string, FittedModel | null>(), tp = new Map<string, (number[] | null)[]>();
  let baseLL: number | null = null; const test = canTest ? h.slice(cut) : [], ys: number[] = test.map(t => outcomeIdx(t.hg, t.ag));
  const candidateCap = GOALGRID_LIMITS.model.candidateMaxModels;
  const activeCap = GOALGRID_LIMITS.model.activeMaxModels;
  const contextModels = ALL_MODELS.filter(m => m.family === "context");
  const marketModels = ALL_MODELS.filter(m => m.family === "market");
  const coreCandidates = ALL_MODELS.filter(m => m.family !== "context" && m.family !== "market" && !m.needs);
  const candidateModels = [...contextModels, ...marketModels, ...coreCandidates].filter((m, i, a) => a.findIndex(x => x.id === m.id) === i).slice(0, candidateCap);
  if (canTest) {
    const train = h.slice(0, cut), at = new Date(test[0].date), rate = [0, 1, 2].map(k => (train.filter(t => outcomeIdx(t.hg, t.ag) === k).length + 1) / (train.length + 3));
    baseLL = -ys.reduce((a, y) => a + Math.log(rate[y]), 0) / ys.length;
    for (const m of candidateModels) {
      if (m.family === "market") continue;
      const f = safe(() => m.fit(train, at)); trainFits.set(m.id, f); if (!f) continue; let l = 0, br = 0, n = 0; const preds: (number[] | null)[] = [];
      for (const t of test) { const p = safe(() => f.predict(t.home, t.away, { kickoffUtc: t.date })); if (!p || ![p.home, p.draw, p.away].every(Number.isFinite)) { preds.push(null); continue; } const v = [p.home, p.draw, p.away], y = outcomeIdx(t.hg, t.ag); preds.push(v); l -= Math.log(Math.max(v[y], 1e-6)); br += v.reduce((a, x, i) => a + (x - (i === y ? 1 : 0)) ** 2, 0); n++; }
      if (n >= 20) { raw.set(m.id, { ll: l / n, br: br / n, n }); tp.set(m.id, preds); }
    }
  }
  const minLL = raw.size ? Math.min(...[...raw.values()].map(r => r.ll)) : 0, fitted: Ensemble["fitted"] = [], waiting: Ensemble["waiting"] = [], metrics: ModelMetric[] = [];
  for (const m of candidateModels) {
    const f = m.heavy && trainFits.get(m.id) ? trainFits.get(m.id)! : safe(() => m.fit(h, now)), r = raw.get(m.id);
    if (!f) { const reason = m.needs ?? "not enough history"; waiting.push({ id: m.id, name: m.name, reason }); metrics.push({ id: m.id, name: m.name, family: m.family, weight: 0, logLoss: null, brier: null, testMatches: 0, status: "waiting", note: reason }); continue; }
    if (r && baseLL != null && r.n >= 50 && r.ll > baseLL + DEGRADE_MARGIN) { const reason = "Did worse than plain base rates on recent matches"; waiting.push({ id: m.id, name: m.name, reason }); tp.delete(m.id); metrics.push({ id: m.id, name: m.name, family: m.family, weight: 0, logLoss: r.ll, brier: r.br, testMatches: r.n, status: "degraded", note: reason }); continue; }
    fitted.push({ model: m, fitted: f, weight: r ? Math.exp(-6 * (r.ll - minLL)) : -1 });
  }
  const candidateSet = new Set(candidateModels.map(m => m.id));
  for (const m of ALL_MODELS) {
    if (candidateSet.has(m.id)) continue;
    const reason = m.needs ? `Waiting for required features: ${m.needs}` : "Not selected by the current model resource budget";
    waiting.push({ id: m.id, name: m.name, reason });
    metrics.push({ id: m.id, name: m.name, family: m.family, weight: 0, logLoss: null, brier: null, testMatches: 0, status: "shadow", note: reason });
  }
  const tested = fitted.filter(x => x.weight >= 0), avg = tested.length ? tested.reduce((a, x) => a + x.weight, 0) / tested.length : 1, fam = new Map<string, number>();
  for (const x of fitted) fam.set(x.model.family, (fam.get(x.model.family) ?? 0) + 1);
  for (const x of fitted) { if (x.weight < 0) x.weight = x.model.family === "market" ? avg : x.model.prior ? 0.5 * avg : canTest ? 0.5 * avg : 1; x.weight /= Math.sqrt(fam.get(x.model.family) ?? 1); }
  // Resource governance: only a bounded active set executes for a prediction. The rest stay registered as shadow/waiting models.
  fitted.sort((a, b) => (raw.has(b.model.id) ? 1 : 0) - (raw.has(a.model.id) ? 1 : 0) || b.weight - a.weight);
  // Reserve a small specialist lane for context models. They may abstain without lineup/weather/news inputs, but when such data exists they must be eligible to contribute.
  const contextActive = fitted.filter(x => x.model.family === "context").slice(0, Math.min(6, activeCap - 3));
  // The market model also keeps a reserved slot: it only contributes when odds are supplied, and it is what the market-gap figure is measured against.
  const marketActive = fitted.filter(x => x.model.family === "market");
  const selected = [...fitted.filter(x => x.model.family !== "context" && x.model.family !== "market").slice(0, Math.max(0, activeCap - contextActive.length - marketActive.length)), ...contextActive, ...marketActive];
  const selectedIds = new Set(selected.map(x => x.model.id));
  for (const x of fitted) {
    if (selectedIds.has(x.model.id)) continue;
    const reason = "Not selected by the current active-model budget", r = raw.get(x.model.id);
    waiting.push({ id: x.model.id, name: x.model.name, reason });
    metrics.push({ id: x.model.id, name: x.model.name, family: x.model.family, weight: 0, logLoss: r?.ll ?? null, brier: r?.br ?? null, testMatches: r?.n ?? 0, status: "shadow", note: reason, calibrated: false });
  }
  fitted.splice(0, fitted.length, ...fitted.filter(x => selectedIds.has(x.model.id)));
  // Per-model calibration, cross-fitted: a calibrator fitted on one half of the held out matches is judged on the other half. It is kept only if it clearly helps, and the held out predictions used below are the cross-fitted ones, so the stacker and conformal wrapper never see predictions a calibrator was fitted on.
  const calib = new Map<string, Calibrator>();
  if (canTest && test.length >= 120) {
    const half = Math.floor(test.length / 2);
    for (const x of fitted) {
      const preds = tp.get(x.model.id); if (!preds) continue; const idx = preds.map((p, i) => (p ? i : -1)).filter(i => i >= 0), A = idx.filter(i => i < half), B = idx.filter(i => i >= half); if (A.length < 50 || B.length < 50) continue;
      const cA = fitCalibrator(A.map(i => preds[i]!), A.map(i => ys[i])), cB = fitCalibrator(B.map(i => preds[i]!), B.map(i => ys[i])), crossed = preds.map((p, i) => (p ? (i < half ? cB(p) : cA(p)) : null));
      if (logLoss(idx.map(i => crossed[i]!), idx.map(i => ys[i])) < logLoss(idx.map(i => preds[i]!), idx.map(i => ys[i])) - 0.003) { x.calibrate = fitCalibrator(idx.map(i => preds[i]!), idx.map(i => ys[i])); calib.set(x.model.id, x.calibrate); tp.set(x.model.id, crossed); }
    }
  }
  const games = new Map<string, number>(); for (const m of h) { games.set(m.home, (games.get(m.home) ?? 0) + 1); games.set(m.away, (games.get(m.away) ?? 0) + 1); }
  for (const x of fitted) { const r = raw.get(x.model.id); metrics.push({ id: x.model.id, name: x.model.name, family: x.model.family, weight: x.weight, logLoss: r?.ll ?? null, brier: r?.br ?? null, testMatches: r?.n ?? 0, status: r ? "tested" : "unvalidated", note: x.model.about ?? null, calibrated: calib.has(x.model.id) }); }
  // Components 99 and 100 use the held out predictions: the weighted ensemble gives the conformal scores, family averages feed the stacker.
  let stack: StackFit | null = null, conformal: ConformalFit | null = null;
  const live = fitted.filter(x => tp.has(x.model.id) && x.weight > 0);
  if (canTest && live.length >= 5 && test.length >= 100) {
    const ens = test.map((_, i) => { let W = 0; const a = [0, 0, 0]; for (const x of live) { const p = tp.get(x.model.id)![i]; if (p) { W += x.weight; for (let k = 0; k < 3; k++) a[k] += x.weight * p[k]; } } return W ? a.map(v => v / W) : [1 / 3, 1 / 3, 1 / 3]; });
    const alpha = 0.2, scores = ens.map((p, i) => 1 - p[ys[i]]).sort((a, b) => a - b), q = Math.min(scores.length - 1, Math.ceil((scores.length + 1) * (1 - alpha)) - 1), threshold = scores[q];
    conformal = { alpha, threshold: r3(threshold), n: scores.length, avgSetSize: r3(ens.reduce((a, p) => a + p.filter(v => 1 - v <= threshold).length, 0) / ens.length) };
    const fams = [...new Set(live.map(x => x.model.family))].filter(f => f !== "market" && f !== "context"), famAvg = (i: number) => fams.map(f => { const ps = live.filter(x => x.model.family === f).map(x => tp.get(x.model.id)![i]).filter((p): p is number[] => !!p); return ps.length ? [0, 1, 2].map(k => ps.reduce((a, p) => a + p[k], 0) / ps.length) : [1 / 3, 1 / 3, 1 / 3]; });
    if (fams.length >= 2) { const F = test.map((_, i) => famAvg(i)), half = Math.floor(F.length / 2), a = fitPool(F.slice(0, half), ys.slice(0, half));
      const llS = ll(F.slice(half).map((fp, j) => pool(fp, a.theta, a.b).map((v, k) => 0.5 * v + 0.5 * ens[half + j][k])), ys.slice(half)), llW = ll(ens.slice(half), ys.slice(half));
      if (llS < llW - 0.005) { const all = fitPool(F, ys); stack = { fams, theta: all.theta.map(r3), b: [r3(all.b[0]), r3(all.b[1])], llStacked: r3(llS), llWeighted: r3(llW), n: F.length - half }; } else stack = null; }
  }
  const probe = h[h.length - 1], matrixIds = probe ? fitted.filter(x => safe(() => x.fitted.predict(probe.home, probe.away, { kickoffUtc: probe.date })?.matrix)).map(x => x.model.id) : [];
  return { fitted, waiting, metrics, games, historyMatches: h.length, builtAt: new Date().toISOString(), matrixIds, baselineLogLoss: baseLL, stack, conformal };
}
/** One match, every model. Models without the data they need abstain and are listed, never guessed. Returns null if fewer than three history models can price the fixture. */
export function predictMatch(e: Ensemble, home: string, away: string, ctx: PredictCtx = {}): Prediction | null {
  const used: { x: Ensemble["fitted"][number]; o: NonNullable<ReturnType<FittedModel["predict"]>> }[] = [], abstained = [...e.waiting.map(w => ({ ...w }))];
  for (const x of e.fitted) { const o0 = safe(() => x.fitted.predict(home, away, ctx)), q = o0 && x.calibrate ? x.calibrate([o0.home, o0.draw, o0.away]) : null, o = o0 && q ? { ...o0, home: q[0], draw: q[1], away: q[2] } : o0; if (o && [o.home, o.draw, o.away].every(Number.isFinite)) used.push({ x, o }); else abstained.push({ id: x.model.id, name: x.model.name, reason: x.model.needs ?? "no data for these teams" }); }
  const hist = used.filter(u => u.x.model.family !== "market"); if (hist.filter(u => u.x.model.family !== "context").length < 3) return null;
  const W = used.reduce((a, u) => a + u.x.weight, 0), avg = (f: (u: typeof used[number]) => number) => used.reduce((a, u) => a + u.x.weight * f(u), 0) / W;
  let p = normalize({ home: avg(u => u.o.home), draw: avg(u => u.o.draw), away: avg(u => u.o.away) }), stacked = false;
  if (e.stack) { const fp = e.stack.fams.map(f => { const o = used.filter(u => u.x.model.family === f); return o.length ? [o.reduce((a, u) => a + u.o.home, 0) / o.length, o.reduce((a, u) => a + u.o.draw, 0) / o.length, o.reduce((a, u) => a + u.o.away, 0) / o.length] : [1 / 3, 1 / 3, 1 / 3]; }), ps = pool(fp, e.stack.theta, e.stack.b);
    p = normalize({ home: 0.5 * p.home + 0.5 * ps[0], draw: 0.5 * p.draw + 0.5 * ps[1], away: 0.5 * p.away + 0.5 * ps[2] }); stacked = true; }
  const mats = used.filter(u => u.o.matrix), MW = mats.reduce((a, u) => a + u.x.weight, 0) || 1;
  let best = { home: 0, away: 0, probability: 0 }, btts = 0, over = 0, eh = 0, ea = 0;
  for (let x = 0; x <= MAXG; x++) for (let y = 0; y <= MAXG; y++) { const v = mats.reduce((a, u) => a + u.x.weight * u.o.matrix![x][y], 0) / MW; if (v > best.probability) best = { home: x, away: y, probability: v }; if (x > 0 && y > 0) btts += v; if (x + y > 2) over += v; eh += v * x; ea += v * y; }
  const sd = (f: (o: typeof hist[number]["o"]) => number) => { const v = hist.map(u => f(u.o)), m = v.reduce((a, b) => a + b, 0) / v.length; return Math.sqrt(v.reduce((a, b) => a + (b - m) ** 2, 0) / v.length); };
  const agreement = Math.max(0, Math.min(1, 1 - 4 * (sd(o => o.home) + sd(o => o.draw) + sd(o => o.away)) / 3)), g = Math.min(e.games.get(home) ?? 0, e.games.get(away) ?? 0), dataQuality = Math.min(1, g / 25);
  const mk = used.find(u => u.x.model.family === "market")?.o, HW = hist.reduce((a, u) => a + u.x.weight, 0), hp = normalize({ home: hist.reduce((a, u) => a + u.x.weight * u.o.home, 0) / HW, draw: hist.reduce((a, u) => a + u.x.weight * u.o.draw, 0) / HW, away: hist.reduce((a, u) => a + u.x.weight * u.o.away, 0) / HW });
  const pv = [p.home, p.draw, p.away], conformal = e.conformal ? { set: OUT.filter((_, k) => 1 - pv[k] <= e.conformal!.threshold) as ("home" | "draw" | "away")[], coverage: 1 - e.conformal.alpha } : null;
  return { probabilities: { home: r3(p.home), draw: r3(p.draw), away: r3(p.away) }, expectedGoals: { home: Math.round(eh * 100) / 100, away: Math.round(ea * 100) / 100 }, mostLikelyScore: { home: best.home, away: best.away, probability: r3(best.probability) },
    btts: r3(btts), over25: r3(over), agreement: r3(agreement), dataQuality: r3(dataQuality), confidence: Math.round(100 * (0.65 * agreement + 0.35 * dataQuality)), marketGap: mk ? r3(Math.max(Math.abs(hp.home - mk.home), Math.abs(hp.draw - mk.draw), Math.abs(hp.away - mk.away))) : null,
    models: used.map(u => ({ id: u.x.model.id, name: u.x.model.name, family: u.x.model.family, weight: r3(u.x.weight / W), home: r3(u.o.home), draw: r3(u.o.draw), away: r3(u.o.away) })), conformal, stacked, modelsUsed: used.length, abstained };
}

/** The weighted score matrix for one fixture, for the Scenario Lab. Same models and weights as the headline prediction; null when no model can price the fixture. */
export function weightedMatrix(e: Ensemble, home: string, away: string, ctx: PredictCtx = {}): number[][] | null {
  const used = e.fitted.flatMap(x => { const o0 = safe(() => x.fitted.predict(home, away, ctx)); if (!o0?.matrix) return []; const q = x.calibrate ? x.calibrate([o0.home, o0.draw, o0.away]) : null; void q; return [{ w: x.weight, m: o0.matrix }]; });
  const W = used.reduce((a, u) => a + u.w, 0); if (!used.length || !W) return null;
  return Array.from({ length: MAXG + 1 }, (_, x) => Array.from({ length: MAXG + 1 }, (_, y) => used.reduce((a, u) => a + u.w * u.m[x][y], 0) / W));
}
