import test from "node:test";
import assert from "node:assert/strict";
import { generateLeague, playSeason, rates } from "../src/lib/simulation/fictional";
import { MAX_ROUNDS, simulateMultiplier, validate as vm, virtualRule } from "../src/lib/simulation/multiplier";
import { MAX_BETS, kellyFraction, runRisk, sensitivity, validate as vr, type RiskConfig } from "../src/lib/simulation/bankroll";
import { FAMILIES, evaluate, generateEvents, score, validateRule as va } from "../src/lib/simulation/alerts";
import { DISCLAIMER, backtest, chances, syntheticObservations, validateRule as vb } from "../src/lib/simulation/backtest";
import { checkShare, researchQuality } from "../src/lib/simulation/strategy";
import { makeRng } from "../src/lib/simulation/rng";
test("fictional league: reproducible, invented names, consistent table", () => {
  const a = generateLeague(12, "S1"), b = generateLeague(12, "S1"); assert.deepEqual(a, b); assert.equal(new Set(a.map(t => t.name)).size, 12); assert.notDeepEqual(a.map(t => t.name), generateLeague(12, "S2").map(t => t.name));
  const s = playSeason(a, "S1"), n = 12; assert.equal(s.matches.length, n * (n - 1)); assert.deepEqual(playSeason(a, "S1"), s);
  assert.equal(s.table.reduce((x, r) => x + r.gf, 0), s.table.reduce((x, r) => x + r.ga, 0)); for (const r of s.table) { assert.equal(r.played, 2 * (n - 1)); assert.equal(r.points, 3 * r.won + r.drawn); assert.equal(r.won + r.drawn + r.lost, r.played); } for (let i = 1; i < s.table.length; i++) assert.ok(s.table[i - 1].points >= s.table[i].points);
  const strong = { name: "A", attack: 1.3, defence: 0.8 }, weak = { name: "B", attack: 0.8, defence: 1.3 }; assert.ok(rates(strong, weak, 1.35, 1.2).lh > rates(weak, strong, 1.35, 1.2).lh);
});
test("multiplier: bounded input, same seed same sequence, heavy right tail, instant stops land at exactly 1.00", () => {
  const c = { family: "pareto" as const, param: 1.2, instantStop: 0.04, rounds: 20000, seed: "M1" }; assert.equal(vm(c), null); assert.ok(vm({ ...c, rounds: MAX_ROUNDS + 1 }) && vm({ ...c, param: 0 }) && vm({ ...c, instantStop: 0.9 }) && vm({ ...c, family: "x" as never }));
  const a = simulateMultiplier(c), b = simulateMultiplier(c); assert.deepEqual(a, b); assert.ok(Math.abs(a.instantStopShare - 0.04) < 0.01); assert.ok(a.summary.status === "ok" && a.summary.min === 1 && a.summary.max <= 1000 && a.summary.mean > a.summary.median);
  const expo = simulateMultiplier({ ...c, family: "exponential", param: 1, instantStop: 0 }); assert.ok(expo.summary.status === "ok" && Math.abs(expo.summary.mean - 2) < 0.1); assert.ok(Math.abs(a.tail[1].share - 0.96 / 2 ** 1.2 * 1) < 0.02);
});
test("multiplier virtual rule: fixed unit and target, drawdown and ruin are exact on a known sequence", () => {
  const r = virtualRule([1, 1, 3, 1, 2, 1], 2, 30, 10); assert.equal(r.roundsPlayed, 6); assert.equal(r.hitRate, 0.3333); assert.ok(r.endBalance > 0); const bust = virtualRule(Array(10).fill(1), 2, 30, 10); assert.equal(bust.ruinedAtRound, 3); assert.equal(bust.endBalance, 0); assert.equal(bust.impliedHitRateForBreakEven, 0.5);
});
test("risk lab: Kelly formula, no edge means no Kelly stake, negative edge ruins, reproducible, bounded", () => {
  assert.ok(Math.abs(kellyFraction(0.6, 2) - 0.2) < 1e-9); assert.equal(kellyFraction(0.4, 2), -0.2 < 0 ? kellyFraction(0.4, 2) : 0); assert.ok(kellyFraction(0.4, 2) < 0);
  const base: RiskConfig = { probability: 0.4, odds: 2, mode: "percent", unit: 10, percent: 10, startBalance: 1000, bets: 200, paths: 400, seed: "R1" }; assert.equal(vr(base), null); assert.ok(vr({ ...base, bets: MAX_BETS + 1 }) && vr({ ...base, probability: 1 }) && vr({ ...base, percent: 80 }) && vr({ ...base, odds: 1 }));
  const neg = runRisk(base), pos = runRisk({ ...base, probability: 0.6 }); assert.deepEqual(runRisk(base), neg); assert.ok(neg.expectedValuePerUnit < 0 && neg.endingBalance.median < base.startBalance && neg.shareEndedBelowStart > 0.8); assert.ok(pos.expectedValuePerUnit > 0 && pos.endingBalance.median > neg.endingBalance.median);
  const k = runRisk({ ...base, mode: "kelly", kellyFraction: 0.5 }); assert.equal(k.endingBalance.median, base.startBalance); assert.equal(sensitivity({ ...base, probability: 0.55 }).length, 4); assert.ok(neg.samplePaths.length <= 12);
});
test("alerts: generator is reproducible, rule is constrained JSON, detection and false alerts are scored against ground truth", () => {
  const g = generateEvents("A1", { minutes: 600, incidents: 3, families: ["queue_backlog", "provider_outage"] }), h = generateEvents("A1", { minutes: 600, incidents: 3, families: ["queue_backlog", "provider_outage"] }); assert.deepEqual(g, h); assert.equal(g.incidents.length, 3); assert.ok(g.events.every((e, i) => i === 0 || e.t >= g.events[i - 1].t));
  const inc = g.incidents[0], rule = { family: inc.family, minSeverity: 7, count: 3, withinMinutes: 10 }; assert.equal(va(rule), null); assert.ok(va({ ...rule, family: "x" as never }) && va({ ...rule, count: 0 }) && va({ ...rule, withinMinutes: 500 }) && va({ ...rule, minSeverity: 11 }));
  const sc = score(rule, g.events, g.incidents); assert.ok(sc.caught >= 1 && sc.falseAlerts === 0); const loose = score({ ...rule, minSeverity: 1, count: 1, withinMinutes: 1 }, g.events, g.incidents); assert.ok(loose.falseAlerts > sc.falseAlerts); assert.deepEqual(evaluate([], rule).firedAt, []); assert.equal(FAMILIES.length, 7);
});
test("backtest: constrained rules only, honest gap measure, small samples refused, disclaimer always present", () => {
  assert.equal(vb({ conditions: [{ field: "pHome", op: ">=", value: 0.5 }], outcome: "home" }), null); assert.ok(vb({ conditions: [], outcome: "home" }) && vb({ conditions: [{ field: "x" as never, op: ">=", value: 0.5 }], outcome: "home" }) && vb({ conditions: [{ field: "pHome", op: "==" as never, value: 0.5 }], outcome: "home" }) && vb({ conditions: [{ field: "pHome", op: ">=", value: 2 }], outcome: "home" }) && vb({ conditions: [{ field: "pHome", op: ">=", value: 0.5 }], outcome: "code" as never }));
  const c = chances(1.6, 1.1); assert.ok(Math.abs(c.pHome + c.pDraw + c.pAway - 1) < 1e-9);
  const obs = syntheticObservations("B1", 16, 8), r = backtest(obs, { conditions: [{ field: "pHome", op: ">=", value: 0.5 }], outcome: "home" }); assert.ok(r.status === "ok"); if (r.status === "ok") { assert.ok(r.triggered > 50 && r.triggerRate > 0 && r.triggerRate < 1); assert.ok(Math.abs(r.gap) < 0.06 && Math.abs(r.gapStandardErrors) < 4); assert.equal(r.disclaimer, DISCLAIMER); assert.ok(r.limitations.length >= 3); assert.ok(!/guarantee|safe|profit machine|winning system|risk-free/i.test(JSON.stringify(r).replace(DISCLAIMER, "").replace(/do not guarantee[^"]*/i, ""))); }
  const none = backtest(obs, { conditions: [{ field: "pHome", op: ">=", value: 0.999 }], outcome: "home" }); assert.equal(none.status, "insufficient"); assert.deepEqual(backtest(obs, { conditions: [{ field: "btts", op: ">=", value: 0.5 }], outcome: "btts" }), backtest(obs, { conditions: [{ field: "btts", op: ">=", value: 0.5 }], outcome: "btts" }));
});
test("strategy sharing: guarantees, payment asks, affiliate links, bots and links are blocked; plain methodology passes", () => {
  for (const bad of ["This is a guaranteed profit system", "risk-free strategy", "Buy my winning system", "Use my link and promo code", "auto-bet bot that places bets for you", "see https://example.com", "this beats the bookies", "send money to join"]) assert.equal(checkShare(bad).ok, false, bad);
  assert.equal(checkShare("Method: backtest on 8 synthetic seasons, seed B1, threshold 0.5. Gap between hit rate and stated probability was small. Limitations: synthetic data.").ok, true);
  const hi = researchQuality({ hasSeed: true, sampleSize: 2000, hasAssumptions: true, hasMethod: true, likes: 30 }), lo = researchQuality({ hasSeed: false, sampleSize: 20, hasAssumptions: false, hasMethod: false, likes: 0 }); assert.equal(hi.score, 1); assert.ok(lo.score < 0.1); assert.ok(!("profit" in hi.parts));
});
test("rng helper stays in range for research modules", () => { const r = makeRng("x"); for (let i = 0; i < 1000; i++) { const v = r(); assert.ok(v >= 0 && v < 1); } });
