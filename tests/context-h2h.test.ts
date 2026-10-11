import test from "node:test";
import assert from "node:assert/strict";
import { headToHeadOf, teamFormOf } from "../src/lib/engine/models/context-stats";
import { headToHead } from "../src/lib/engine/models/h2h";
import { baselinePrediction, type Ensemble } from "../src/lib/engine/models/ensemble";
import type { HistMatch } from "../src/types/prediction";

const d = (i: number) => new Date(Date.UTC(2026, 0, 1 + i)).toISOString();
const hist: HistMatch[] = [
  { date: d(1), home: "a", away: "b", hg: 2, ag: 0 }, { date: d(2), home: "b", away: "a", hg: 1, ag: 1 }, { date: d(3), home: "a", away: "c", hg: 0, ag: 1 },
  { date: d(4), home: "b", away: "a", hg: 0, ag: 3 }, { date: d(5), home: "a", away: "b", hg: 1, ag: 2 }, { date: d(6), home: "c", away: "a", hg: 2, ag: 2 },
];
test("form reads the last results, oldest to newest, from either side", () => {
  const f = teamFormOf(hist, "a"); assert.equal(f.form, "DLWLD"); const f3 = teamFormOf(hist, "a", 3);
  assert.deepEqual([f3.form, f3.played, f3.goalsFor, f3.goalsAgainst, f3.points], ["WLD", 3, 6, 4, 4]);
  assert.deepEqual(teamFormOf(hist, "nobody"), { form: "", played: 0, goalsFor: 0, goalsAgainst: 0, points: 0 });
});
test("head to head counts meetings at either ground from the fixture home team's side", () => {
  const h = headToHeadOf(hist, "a", "b"); assert.deepEqual([h.meetings, h.homeWins, h.draws, h.awayWins], [4, 2, 1, 1]);
  const r = headToHeadOf(hist, "b", "a"); assert.deepEqual([r.homeWins, r.draws, r.awayWins], [1, 1, 2]);
  assert.equal(headToHeadOf(hist, "a", "zzz").meetings, 0);
});
test("the h2h model abstains without meetings and tilts toward the club with the better record", () => {
  const many: HistMatch[] = Array.from({ length: 70 }, (_, i) => ({ date: d(10 + i), home: i % 2 ? "x" : "y", away: i % 2 ? "y" : "x", hg: i % 3, ag: (i + 1) % 3 })).concat(hist);
  const m = headToHead.fit(many, new Date())!; assert.equal(m.predict("a", "zzz"), null);
  const o = m.predict("a", "b")!, r = m.predict("b", "a")!; assert.ok(Math.abs(o.home + o.draw + o.away - 1) < 1e-9);
  assert.ok(o.home / o.away > r.home / r.away, "the club with the better record is favoured at either ground");
  assert.equal(headToHead.fit(hist, new Date()), null);
});
test("every prediction market comes from one matrix: totals nest and the top scorelines are sorted", () => {
  const e = { games: new Map(), base: { home: 0.45, draw: 0.26, away: 0.29, goalsHome: 1.5, goalsAway: 1.2 } } as unknown as Ensemble, p = baselinePrediction(e, {}, "x");
  assert.ok(p.over15! >= p.over25 && p.over25 >= p.over35!); assert.equal(p.topScores!.length, 3);
  assert.ok(p.topScores![0].probability >= p.topScores![1].probability && p.topScores![1].probability >= p.topScores![2].probability);
});
