import test from "node:test";
import assert from "node:assert/strict";
import { ALL_MODELS, buildEnsemble, predictMatch } from "../src/lib/engine/models/ensemble";
import { lgamma, poissonPmf } from "../src/lib/engine/models/math";
import type { HistMatch } from "../src/types/prediction";
let seed = 42; const rnd = () => (seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296;
const pois = (l: number) => { const L = Math.exp(-l); let k = 0, p = 1; do { k++; p *= rnd(); } while (p > L); return k - 1; };
const teams = ["strong-a", "strong-b", "mid-c", "mid-d", "mid-e", "mid-f", "weak-g", "weak-h", "weak-i", "weak-j"];
const att: Record<string, number> = { "strong-a": 1.5, "strong-b": 1.35, "mid-c": 1.05, "mid-d": 1, "mid-e": 1, "mid-f": 0.95, "weak-g": 0.8, "weak-h": 0.75, "weak-i": 0.7, "weak-j": 0.65 };
const def: Record<string, number> = { "strong-a": 0.65, "strong-b": 0.75, "mid-c": 0.95, "mid-d": 1, "mid-e": 1, "mid-f": 1.05, "weak-g": 1.2, "weak-h": 1.25, "weak-i": 1.3, "weak-j": 1.4 };
const hist: HistMatch[] = []; let day = 0;
for (let r = 0; r < 8; r++) for (const h of teams) for (const a of teams) if (h !== a) { hist.push({ date: new Date(Date.UTC(2025, 7, 1) + (day++ / 3) * 86_400_000).toISOString(), home: h, away: a, hg: pois(1.4 * att[h] * def[a]), ag: pois(1.1 * att[a] * def[h]) }); }
const NOW = new Date(Date.UTC(2026, 3, 1));
const t0 = Date.now(); const ens = buildEnsemble(hist, NOW); console.log("ensemble fit ms", Date.now() - t0, "matches", hist.length);
test("math: lgamma and poisson", () => { assert.ok(Math.abs(lgamma(5) - Math.log(24)) < 1e-9); assert.ok(Math.abs(poissonPmf(2, 1.5) - Math.exp(-1.5) * 1.125) < 1e-9); });
test("all history models fit and are scored out of sample", () => {
  assert.equal(ALL_MODELS.length, 83); assert.equal(ens.metrics.length, 83);
  const scored = ens.metrics.filter(m => m.logLoss != null), tested = ens.metrics.filter(m => m.status === "tested");
  assert.ok(scored.length >= 20 && scored.length <= 30, `scored ${scored.length}`);
  assert.ok(tested.length >= 5 && tested.length <= 15, `active tested ${tested.length}`); assert.ok(ens.metrics.every(m => m.status !== "shadow" || m.weight === 0));
  for (const m of scored) { assert.ok(m.logLoss! > 0 && m.logLoss! < Math.log(3) + 0.03, `${m.id} ll ${m.logLoss}`); assert.ok(m.testMatches > 50); }
  console.log(tested.map(m => `${m.id}:${m.logLoss!.toFixed(3)}`).join(" "), "| waiting:", ens.metrics.filter(m => m.status === "waiting").map(m => m.id).join(","));
});
test("every model returns valid probabilities", () => {
  const p = predictMatch(ens, "strong-a", "weak-j", { market: { home: 0.8, draw: 0.13, away: 0.07 }, kickoffUtc: "2026-04-02T15:00:00Z" })!;
  assert.equal(p.models.length + p.abstained.length, 83); assert.ok(p.models.length <= 15 && p.models.length >= 8, `used ${p.models.length}`);
  for (const m of p.models) assert.ok(Math.abs(m.home + m.draw + m.away - 1) < 0.01 && m.home >= 0 && m.draw >= 0 && m.away >= 0, m.id);
  assert.ok(Math.abs(Object.values(p.probabilities).reduce((a, b) => a + b, 0) - 1) < 0.005);
});
test("ensemble ranks strong over weak and respects home advantage", () => {
  const a = predictMatch(ens, "strong-a", "weak-j")!, b = predictMatch(ens, "weak-j", "strong-a")!, c = predictMatch(ens, "mid-d", "mid-e")!, d = predictMatch(ens, "mid-e", "mid-d")!;
  assert.ok(a.probabilities.home > 0.6 && a.probabilities.home > b.probabilities.home + 0.3); assert.ok(b.probabilities.away > b.probabilities.home);
  assert.ok(c.probabilities.home + d.probabilities.home > c.probabilities.away + d.probabilities.away); assert.ok(a.expectedGoals.home > a.expectedGoals.away);
  assert.ok(a.btts > 0 && a.btts < 1 && a.over25 > 0 && a.over25 < 1 && a.confidence > 0 && a.confidence <= 100);
});
test("unknown team gives no prediction; market adds a gap figure", () => {
  assert.equal(predictMatch(ens, "strong-a", "nobody-fc"), null);
  const p = predictMatch(ens, "mid-c", "mid-d", { market: { home: 0.2, draw: 0.3, away: 0.5 } })!; assert.ok(p.marketGap! > 0.1); assert.equal(predictMatch(ens, "mid-c", "mid-d")!.marketGap, null);
});
test("too little history yields no ensemble models", () => { assert.equal(buildEnsemble(hist.slice(0, 20), NOW).fitted.filter(f => f.model.family !== "market").length, 0); });

test("context models: signals and weather move the forecast, absent data abstains", () => {
  const base = predictMatch(ens, "mid-c", "mid-d", {})!, ids = (p: typeof base) => p.models.map(m => m.id);
  assert.ok(base.abstained.some(a => a.id === "player-availability" && a.reason.length > 5));
  const sig = predictMatch(ens, "mid-c", "mid-d", { signals: { availabilityShift: -0.6, newsShift: 0.2 }, weather: { tempC: 10, windKmh: 40, rainChancePct: 70 }, kickoffUtc: "2026-04-02T15:00:00Z" })!;
  const a = sig.models.find(m => m.id === "player-availability")!, b = base.probabilities;
  assert.ok(a && a.home < b.home - 0.03); assert.ok(ids(sig).includes("weather-venue") && ids(sig).includes("news-sentiment") && ids(sig).includes("rest-congestion"));
});

import { buildRegistry } from "../src/lib/engine/registry";
import { tilt } from "../src/lib/engine/models/extra-math";
import { matrixFrom } from "../src/lib/engine/models/math";
test("registry: every base model listed once, statuses measured, meta components present, retired entries explained", () => {
  const reg = buildRegistry(ens), ids = reg.map(r => r.id); assert.equal(new Set(ids).size, ids.length);
  assert.equal(reg.filter(r => r.kind === "base" && r.status !== "retired").length, 83); assert.ok(reg.some(r => r.id === "stacked-meta-learner") && reg.some(r => r.id === "conformal-wrapper"));
  const retired = reg.filter(r => r.status === "retired"); assert.equal(retired.length, 15); assert.ok(retired.every(r => r.note && r.note.length > 10));
  assert.ok(reg.filter(r => r.status === "production").every(r => r.lastTrainedAt) && reg.filter(r => r.status === "research").every(r => r.lastTrainedAt === null));
  console.log("production", reg.filter(r => r.status === "production").length, "degraded", reg.filter(r => r.status === "degraded").map(r => r.id).join(","), "stack", JSON.stringify(ens.stack), "conformal", JSON.stringify(ens.conformal));
});
test("degraded models get no weight and are listed as abstaining with the reason", () => {
  for (const m of ens.metrics.filter(m => m.status === "degraded")) { assert.equal(m.weight, 0); assert.ok(m.logLoss! > ens.baselineLogLoss!); assert.ok(!ens.fitted.some(f => f.model.id === m.id)); }
});
test("conformal set: contains the likeliest result and is smaller than all three for a clear favourite", () => {
  assert.ok(ens.conformal && ens.conformal.n > 100 && ens.conformal.threshold > 0 && ens.conformal.threshold < 1);
  const a = predictMatch(ens, "strong-a", "weak-j")!; assert.ok(a.conformal!.set.includes("home") && a.conformal!.set.length < 3 && Math.abs(a.conformal!.coverage - 0.8) < 1e-9);
});
test("tilt moves BTTS to the target and keeps a valid matrix", () => {
  const m = matrixFrom((x, y) => Math.exp(-x) * Math.exp(-1.3 * y)), t = tilt(m, { btts: 0.7 });
  let b = 0, s = 0; t.forEach((r, x) => r.forEach((v, y) => { s += v; if (x > 0 && y > 0) b += v; })); assert.ok(Math.abs(s - 1) < 1e-9 && Math.abs(b - 0.7) < 0.02, `btts ${b}`);
});

import { walkForwardBacktest } from "../src/lib/engine/evaluation/backtest";
import { poisson, dixonColes } from "../src/lib/engine/models/goal-models";
import { betaBtts, betaOver } from "../src/lib/engine/models/form-models";
test("walk-forward backtest: folds move forward in time, markets scored separately, matrix-less models get no market score", () => {
  const r = walkForwardBacktest(hist, { folds: 3, models: [poisson, dixonColes, betaBtts, betaOver, ALL_MODELS.find(m => m.id === "elo")!] });
  assert.equal(r.folds.length, 3); for (let i = 1; i < r.folds.length; i++) { assert.ok(r.folds[i].testFrom > r.folds[i - 1].testFrom); assert.ok(r.folds[i].trainMatches > r.folds[i - 1].trainMatches); assert.ok(r.folds[i].testFrom > "2025"); }
  const m = (id: string) => r.models.find(x => x.id === id)!;
  assert.ok(m("poisson").logLoss! > 0 && m("poisson").bttsBrier! > 0 && m("poisson").over25Brier! > 0 && m("poisson").ece! >= 0 && m("poisson").coverage > 0.9);
  assert.equal(m("elo").bttsBrier, null); assert.ok(m("elo").logLoss! > 0);
  assert.ok(m("poisson").logLoss! < r.baseline.logLoss + 0.01);
  console.log("backtest", JSON.stringify(r.baseline), "poisson btts", m("poisson").bttsBrier, "beta-btts", m("beta-binomial-btts").bttsBrier);
});

import { PRESETS, compareSummaries, resolveScenarios, summarize, tiltMatrix } from "../src/lib/engine/scenarios";
const pm = (lh: number, la: number) => { const M = Array.from({ length: 9 }, (_, x) => Array.from({ length: 9 }, (_, y) => poissonPmf(x, lh) * poissonPmf(y, la))), s = M.flat().reduce((a, b) => a + b, 0); return M.map(r => r.map(v => v / s)); };
test("scenario tilt on a Poisson matrix equals Poisson with scaled rates", () => {
  const t = tiltMatrix(pm(1.6, 1.1), 0.9, 1.1), want = pm(1.44, 1.21); for (let x = 0; x < 9; x++) for (let y = 0; y < 9; y++) assert.ok(Math.abs(t[x][y] - want[x][y]) < 1e-9, `${x}-${y}`);
  const s = summarize(t); assert.ok(Math.abs(s.home + s.draw + s.away - 1) < 0.002);
});
test("scenarios: a weaker home attack lowers the home win, changes sum to zero, unknown ids and wild multipliers are refused", () => {
  const M = pm(1.6, 1.1), base = summarize(M), r = resolveScenarios(["home-striker-out"], null, base); assert.ok(r.ok); if (!r.ok) return;
  const sc = summarize(tiltMatrix(M, r.mh, r.ma)), c = compareSummaries(base, sc); assert.ok(c.homePp < 0 && c.awayPp > 0 && c.xgHome < 0); assert.ok(Math.abs(c.homePp + c.drawPp + c.awayPp) < 0.3);
  assert.ok(!resolveScenarios(["nope"], null, base).ok); assert.ok(!resolveScenarios([], { home: 3 }, base).ok); assert.ok(!resolveScenarios([], { home: 0.1 }, base).ok);
  const stack = resolveScenarios(["home-striker-out", "home-fatigue", "heavy-rain", "home-striker-out"], null, base); assert.ok(stack.ok && stack.mh >= 0.5);
});
test("home advantage removal is derived from the match and makes expected goals equal", () => {
  const M = pm(1.8, 0.9), base = summarize(M), r = resolveScenarios(["no-home-advantage"], null, base); assert.ok(r.ok && r.applied[0].kind === "derived"); if (!r.ok) return; const sc = summarize(tiltMatrix(M, r.mh, r.ma)); assert.ok(Math.abs(sc.xgHome - sc.xgAway) < 0.02);
  assert.ok(PRESETS.filter(p => p.kind === "assumption").every(p => /adjustable assumption/.test(p.note)));
});
