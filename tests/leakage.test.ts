import test from "node:test";
import assert from "node:assert/strict";
import type { HistMatch } from "../src/types/prediction";
import { buildFeatures } from "../src/lib/engine/models/features";
import { poisson } from "../src/lib/engine/models/goal-models";
import { kalmanStrength, betaBtts } from "../src/lib/engine/models/form-models";
import { ALL_MODELS } from "../src/lib/engine/models/ensemble";
import { CONTEXT_FEATURES, FEATURES, postMatchFeatures } from "../src/lib/engine/features/registry";
import { ENGINE_VERSION, FREEZE_MINUTES, isFrozen, movement, planVersion } from "../src/lib/engine/versioning";
import { ece, fitCalibrator, fitIsotonic, logLoss } from "../src/lib/engine/calibration";
import { rng } from "../src/lib/engine/models/math";
const r = rng(11), teams = Array.from({ length: 10 }, (_, i) => `t${i}`);
const hist: HistMatch[] = Array.from({ length: 400 }, (_, i) => { const h = teams[Math.floor(r() * 10)]; let a = teams[Math.floor(r() * 10)]; if (a === h) a = teams[(teams.indexOf(a) + 1) % 10]; return { date: new Date(Date.UTC(2025, 0, 1) + i * 86_400_000).toISOString(), home: h, away: a, hg: Math.floor(r() * 4), ag: Math.floor(r() * 3) }; });
test("features: a row never changes when later results change", () => {
  const cut = 250, a = buildFeatures(hist).rows, altered = hist.map((m, i) => (i >= cut ? { ...m, hg: 9, ag: 0 } : m)), b = buildFeatures(altered).rows;
  const before = a.filter(x => x.date < hist[cut].date), before2 = b.filter(x => x.date < hist[cut].date); assert.ok(before.length > 100); assert.deepEqual(before.map(x => x.xe), before2.map(x => x.xe)); assert.deepEqual(before.map(x => x.seq), before2.map(x => x.seq));
});
test("features: input order does not matter, only dates", () => { const a = buildFeatures(hist).rows.map(x => x.xe), b = buildFeatures([...hist].reverse()).rows.map(x => x.xe); assert.deepEqual(a, b); });
test("models: predictions for test fixtures do not depend on test results", () => {
  const cut = 300, train = hist.slice(0, cut), now = new Date(hist[cut].date), mutated = hist.map((m, i) => (i >= cut ? { ...m, hg: 7, ag: 7 } : m)).slice(0, cut);
  for (const m of [poisson, kalmanStrength, betaBtts, ...ALL_MODELS.filter(x => ["elo", "massey", "dixon-coles"].includes(x.id))]) {
    const a = m.fit(train, now), b = m.fit(mutated, now); const fx = hist.slice(cut, cut + 5); for (const t of fx) assert.deepEqual(a?.predict(t.home, t.away, { kickoffUtc: t.date }) ?? null, b?.predict(t.home, t.away, { kickoffUtc: t.date }) ?? null, m.id);
  }
});
test("feature registry stays in sync with the real feature vector and has nothing from after the match", () => {
  assert.equal(FEATURES.length, buildFeatures(hist).rows[0].xe.length); assert.deepEqual(FEATURES.map(f => f.index), FEATURES.map((_, i) => i)); assert.equal(postMatchFeatures().length, 0); assert.ok(CONTEXT_FEATURES.every(f => f.rule.length > 10));
});
test("versioning: freeze, unchanged and changed predictions", () => {
  const ko = Date.parse("2026-10-10T15:00:00Z"), early = ko - 3 * 3_600_000, p = { pHome: 0.5, pDraw: 0.25, pAway: 0.25 };
  assert.deepEqual(planVersion(null, p, ko, early), { action: "insert", version: 1 }); const l = { ...p, version: 1, engineVersion: ENGINE_VERSION };
  assert.deepEqual(planVersion(l, { ...p, pHome: 0.502 }, ko, early), { action: "skip", reason: "unchanged" }); assert.deepEqual(planVersion(l, { ...p, pHome: 0.52 }, ko, early), { action: "insert", version: 2 });
  assert.deepEqual(planVersion(l, { ...p, pHome: 0.9 }, ko, ko - (FREEZE_MINUTES - 1) * 60_000), { action: "skip", reason: "frozen" }); assert.deepEqual(planVersion(null, p, ko, ko + 1), { action: "skip", reason: "frozen" });
  assert.deepEqual(planVersion({ ...l, engineVersion: "old" }, p, ko, early), { action: "insert", version: 2 }); assert.ok(isFrozen(ko, ko - 60_000) && !isFrozen(ko, ko - 3_600_000));
});
test("movement: first to latest change and the largest step", () => {
  const v = [{ version: 1, pHome: 0.5, pDraw: 0.3, pAway: 0.2 }, { version: 2, pHome: 0.52, pDraw: 0.29, pAway: 0.19 }, { version: 3, pHome: 0.6, pDraw: 0.25, pAway: 0.15 }].map(x => ({ ...x, createdAt: "", engineVersion: "e", confidence: null })), m = movement(v);
  assert.equal(m.change!.home, 0.1); assert.deepEqual([m.largestStep!.from, m.largestStep!.to], [2, 3]); assert.equal(movement(v.slice(0, 1)).change, null);
});
test("calibration: isotonic is monotone, repairs an overconfident model, and helps out of sample", () => {
  const f = fitIsotonic([0.1, 0.2, 0.3, 0.4, 0.5, 0.6], [0, 1, 0, 1, 1, 1]); const xs = [0, 0.15, 0.3, 0.45, 0.55, 1].map(f); for (let i = 1; i < xs.length; i++) assert.ok(xs[i] >= xs[i - 1] - 1e-12);
  const mk = (n: number) => { const preds: number[][] = [], y: number[] = []; for (let i = 0; i < n; i++) { const t = [0.45, 0.28, 0.27], c = r() < t[0] ? 0 : r() < t[1] / (t[1] + t[2]) ? 1 : 2; y.push(c); const over = [0.75, 0.1, 0.15]; preds.push(over); } return { preds, y }; };
  const tr = mk(800), te = mk(800), cal = fitCalibrator(tr.preds, tr.y); assert.ok(logLoss(te.preds.map(cal), te.y) < logLoss(te.preds, te.y) - 0.1); assert.ok(ece(te.preds.map(cal), te.y) < ece(te.preds, te.y));
  const s = cal([0.75, 0.1, 0.15]); assert.ok(Math.abs(s[0] + s[1] + s[2] - 1) < 1e-9);
});
