import test from "node:test";
import assert from "node:assert/strict";
import { marketProblems, marketsOf, matchPayload } from "../src/lib/engine/markets";
import { analysisOf } from "../src/lib/engine/analysis";
import { baselinePrediction, type Ensemble } from "../src/lib/engine/models/ensemble";
import { streakOf, venueOf } from "../src/lib/engine/models/context-stats";
import { MATCH_ID_RE } from "../src/lib/football/match-id";
import type { Match } from "../src/types/football";
import type { HistMatch, Prediction } from "../src/types/prediction";

const e = { games: new Map(), base: { home: 0.45, draw: 0.26, away: 0.29, goalsHome: 1.5, goalsAway: 1.2 } } as unknown as Ensemble;
const match = { id: "ga:abc123", league: { slug: "premier-league", name: "Premier League", providerId: "1" }, home: { providerId: "1", name: "Arsenal", shortName: null, slug: "arsenal", crestUrl: null }, away: { providerId: "2", name: "Leeds United", shortName: null, slug: "leeds-united", crestUrl: null }, kickoffUtc: "2026-10-10T11:30:00Z", status: "scheduled", score: { home: null, away: null }, matchday: null, venue: null, provenance: { source: "goal-api", retrievedAt: "", sourceTimestamp: null, expiresAt: "" } } as unknown as Match;
const d = (i: number) => new Date(Date.UTC(2026, 0, 1 + i)).toISOString();
const hist: HistMatch[] = [{ date: d(1), home: "a", away: "b", hg: 2, ag: 0 }, { date: d(2), home: "c", away: "a", hg: 0, ag: 1 }, { date: d(3), home: "a", away: "d", hg: 3, ag: 0 }, { date: d(4), home: "e", away: "a", hg: 1, ag: 2 }];

test("markets are one consistent set with no NaN, from a full or an old-style prediction", () => {
  const p = baselinePrediction(e, { market: { home: 0.54, draw: 0.25, away: 0.21 } }, "x"), m = marketsOf(p);
  assert.deepEqual(marketProblems(m), []); assert.ok(Math.abs(m.doubleChance.homeOrDraw - (m.outcome1X2.homeWin + m.outcome1X2.draw)) < 0.002);
  assert.ok(Math.abs(m.bothTeamsToScore.ggYes + m.bothTeamsToScore.ggNo - 1) < 0.002 && Math.abs(m.overallGoals.over25 + m.overallGoals.under25 - 1) < 0.002);
  const old = { ...p, over15: undefined, over35: undefined, topScores: undefined } as unknown as Prediction; assert.deepEqual(marketProblems(marketsOf(old)), []);
  const broken = { ...p, probabilities: { home: NaN, draw: 0.3, away: 0.3 }, btts: NaN } as Prediction; assert.deepEqual(marketProblems(marketsOf(broken)), []);
});
test("streaks and ground records read the latest run and one ground only", () => {
  const s = streakOf(hist, "a"); assert.deepEqual([s.wins, s.unbeaten, s.scoredIn, s.cleanSheets], [4, 4, 4, 0]);
  const v = venueOf(hist, "a", "away"); assert.deepEqual([v.played, v.wins, v.goalsFor, v.goalsAgainst], [2, 2, 3, 1]);
  assert.equal(streakOf(hist, "nobody").wins, 0);
});
test("analysis is short, names the teams, never promises a result, and flags a baseline", () => {
  const p = baselinePrediction(e, {}, "No match history found for Leeds United, so this uses league averages."), a = analysisOf(match, { ...p, context: { homeForm: { form: "WWDLW", played: 5, goalsFor: 9, goalsAgainst: 4, points: 10 }, awayForm: { form: "LLDLW", played: 5, goalsFor: 4, goalsAgainst: 9, points: 4 }, homeStreak: streakOf(hist, "a"), awayStreak: streakOf(hist, "b"), h2h: { meetings: 3, homeWins: 2, draws: 1, awayWins: 0, last: [] } } });
  for (const t of [a.summary, a.form, a.tactical, a.uncertainty]) { assert.ok(t.length > 20 && !/NaN|undefined/.test(t), t); assert.ok(!/guarantee(d)? win|certain to|will win/i.test(t)); }
  assert.match(a.form, /Arsenal: WWDLW/); assert.match(a.form, /Head to head, last 3/); assert.match(a.uncertainty, /league averages/); assert.match(a.uncertainty, /not guarantees/);
  const payload = matchPayload(match, p); assert.equal(payload.matchId, "ga:abc123"); assert.ok(payload.analysis.summary && payload.dataQualityScore === 0);
});
test("match ids from every fixture provider are accepted", () => {
  for (const id of ["sm:19", "fd:555038", "ga:cm9x2k1", "bb:abc-12_x", "af:1234", "ts:77"]) assert.ok(MATCH_ID_RE.test(id), id);
  for (const id of ["xx:1", "ga:", "ga:a b", "../x", "ga:" + "a".repeat(80)]) assert.ok(!MATCH_ID_RE.test(id), id);
});
