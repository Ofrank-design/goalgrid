import test from "node:test";
import assert from "node:assert/strict";
import { pickByName, num, addDays, observedBefore } from "../src/lib/providers/resolve";
import { normalizeTsMatches, readTsStats, tsOddsToEvent } from "../src/lib/providers/thestatsapi/normalize";
import { normalizeGoalFixtures, readGoalStats, kickoffOf, readGoalForm } from "../src/lib/providers/goal-api/normalize";
import { normalizeBigBalls, readElo, readForm } from "../src/lib/providers/big-balls/normalize";
import { selectProviders } from "../src/lib/engine/ingestion/fixture-plan";
import { availabilityShiftFrom, eloGap } from "../src/lib/engine/ingestion/signals-core";
import { buildMarket } from "../src/lib/engine/normalization/odds";
import { validateMatch } from "../src/lib/engine/validation/match";
import { byBigBalls, leagueEntry } from "../src/lib/football/league-registry";

test("name matching ignores spacing and prefers the exact competition", () => {
  const rows = [{ n: "Premier League 2" }, { n: "Premier League" }, { n: "Women's Premier League" }];
  assert.equal(pickByName(rows, r => r.n, "Premier League")?.n, "Premier League");
  assert.equal(pickByName([{ n: "La Liga" }], r => r.n, "LaLiga")?.n, "La Liga");
  assert.equal(pickByName([{ n: "Serie A Enilive" }, { n: "Serie A Femminile Pro" }], r => r.n, "Serie A")?.n, "Serie A Enilive");
  assert.equal(pickByName([{ n: "Ligue 2" }], r => r.n, "Ligue 1"), undefined);
});
test("num never turns missing into zero", () => {
  assert.equal(num("54%"), 54); assert.equal(num(null), null); assert.equal(num(""), null); assert.equal(num("abc"), null); assert.equal(num(0), 0);
});
test("anti-leakage: only values observed at or before the prediction time pass", () => {
  assert.equal(observedBefore("2026-10-10T10:00:00Z", "2026-10-10T10:00:00Z"), true);
  assert.equal(observedBefore("2026-10-10T10:00:01Z", "2026-10-10T10:00:00Z"), false);
  assert.equal(observedBefore("junk", "2026-10-10T10:00:00Z"), false);
  assert.equal(addDays("2026-10-30", 3), "2026-11-02");
});

test("TheStatsAPI fixtures normalise and pass match validation", () => {
  const ms = normalizeTsMatches([{ id: "mt_1", competition_id: "comp_3039", status: "scheduled", utc_date: "2026-10-10T14:00:00.000Z", home_team: { id: "tm_1", name: "Arsenal" }, away_team: { id: "tm_2", name: "Chelsea" }, score: { home: null, away: null } }], "premier-league");
  assert.equal(ms.length, 1); assert.equal(ms[0].id, "ts:mt_1"); assert.equal(ms[0].provenance.source, "thestatsapi"); assert.deepEqual(validateMatch(ms[0]), []);
});
test("TheStatsAPI stats: missing stays null, pass accuracy is derived", () => {
  const s = readTsStats({ overview: { ball_possession: { all: { home: 54, away: 46 } }, passes: { all: { home: 400, away: 300 } }, accurate_passes: { all: { home: 360, away: 240 } }, expected_goals: { all: { home: 1.45, away: 0.82 } } } }, "ts:mt_1")!;
  assert.equal(s.possession.home, 54); assert.equal(s.passAccuracy.home, 90); assert.equal(s.passAccuracy.away, 80); assert.equal(s.xg.away, 0.82); assert.equal(s.shots.home, null);
  assert.equal(readTsStats({ overview: {} }, "x"), null); assert.equal(readTsStats(null, "x"), null);
});
test("TheStatsAPI odds go through the shared margin removal to probabilities that sum to 1", () => {
  const [m] = normalizeTsMatches([{ id: "mt_1", competition_id: "c", status: "scheduled", utc_date: "2026-10-10T14:00:00Z", home_team: { id: "1", name: "Arsenal" }, away_team: { id: "2", name: "Chelsea" } }], "premier-league");
  const ev = tsOddsToEvent([{ bookmaker: "Pinnacle", markets: { match_odds: { home: { last_seen: "2.00" }, draw: { last_seen: "3.50" }, away: { last_seen: "4.00" } }, total_goals: { "2.5": { over: { last_seen: "1.90" }, under: { last_seen: "1.95" } } } } }, { bookmaker: "Broken", markets: { match_odds: { home: { last_seen: "0.5" }, draw: { last_seen: "x" }, away: { last_seen: "3" } } } }], m)!;
  assert.equal(ev.bookmakers.length, 1);
  const snap = buildMarket(ev)!, p = snap.impliedProbabilities; assert.ok(Math.abs(p.home + p.draw + p.away - 1) < 0.001); assert.ok(snap.goals25);
});

test("GOAL API tolerates odd shapes and never invents a kickoff or a zero", () => {
  assert.equal(kickoffOf({ matchDate: "2026-10-10", matchTime: "14:00" }), "2026-10-10T14:00:00.000Z"); assert.equal(kickoffOf({ date: "2026-10-10" }), null);
  const ms = normalizeGoalFixtures([{ id: "g1", status: "SCHEDULED", kickoff: "2026-10-10T14:00:00Z", homeTeam: { id: 1, name: "Arsenal" }, awayTeam: { id: 2, name: "Chelsea" }, homeScore: null }, { id: "g2", homeTeam: { name: "A" } }, "junk"], "premier-league");
  assert.equal(ms.length, 1); assert.equal(ms[0].score.home, null);
  const a = readGoalStats([{ type: "Ball Possession", home: "54%", away: "46%" }, { type: "Shots on Goal", home: 5, away: 2 }, { type: "Shots off Goal", home: 9, away: 9 }], "ga:g1")!;
  assert.equal(a.possession.home, 54); assert.equal(a.shotsOnTarget.away, 2); assert.equal(a.shots.home, null);
  assert.equal(readGoalStats({ possession: "55:45", expectedGoals: { home: 1.1, away: 0.7 } }, "x")!.possession.away, 45);
  assert.equal(readGoalStats({ weird: true }, "x"), null);
  assert.equal(readGoalForm([{ team: { name: "Arsenal FC" }, form: "w-w-d" }]).get("arsenal"), "WWD");
});

test("Big Balls matches, Elo and form", () => {
  const ms = normalizeBigBalls([{ id: "u1", kickoff_utc: "2026-10-10T14:00:00Z", status: "in_progress", round: "Regular Season - 7", home: { id: "h", name: "Arsenal" }, away: { id: "a", name: "Chelsea" }, score: { home: 1, away: 0 } }], "premier-league");
  assert.equal(ms[0].status, "live"); assert.equal(ms[0].matchday, 7); assert.deepEqual(validateMatch(ms[0]), []);
  assert.equal(readElo({ rating: 1712.4, league_rank: 2 }).elo, 1712.4); assert.equal(readElo({ rating: 5 }).elo, null); assert.equal(readElo(null).elo, null);
  assert.equal(readForm({ stats: { form_string: "WLWLL" } }), "WLWLL"); assert.equal(readForm({}), null);
});

test("registry: the five big leagues carry all three new provider keys, Big Balls codes are unique", () => {
  for (const s of ["premier-league", "la-liga", "serie-a", "bundesliga", "ligue-1"]) { const l = leagueEntry(s)!; assert.ok(l.ts && l.ga && l.bb, s); }
  assert.equal(byBigBalls("epl")?.slug, "premier-league"); assert.equal(byBigBalls("nope"), undefined);
});

test("fallback chain: later tiers are asked only when needed", () => {
  const P = (id: string, on = true) => ({ id, configured: () => on });
  const fd = P("football-data"), sm = P("sportmonks"), bb = P("big-balls"), ts = P("thestatsapi"), af = P("api-football"), ga = P("goal-api");
  assert.deepEqual(selectProviders([fd, sm], [], false).map(p => p.id), ["football-data", "sportmonks"]);
  assert.deepEqual(selectProviders([bb, ts], [fd, sm], true), [], "tier 1 covered the big five: no extra spend");
  assert.deepEqual(selectProviders([bb, ts], [fd, sm], false).map(p => p.id), ["big-balls", "thestatsapi"], "tier 1 empty or failed: fall back");
  assert.deepEqual(selectProviders([af, ga], [fd, sm, bb, ts], true), [], "Sportmonks already covers the extra leagues: no spend");
  assert.deepEqual(selectProviders([af, ga], [fd, bb, ts], true).map(p => p.id), ["api-football"], "without Sportmonks, only API-Football adds leagues (Danish, Scottish) the others cannot serve");
  assert.deepEqual(selectProviders([bb, ts], [], false.valueOf()).length, 2); assert.deepEqual(selectProviders([P("big-balls", false)], [], false), []);
});

test("availability shift: sign, cap and zero", () => {
  assert.equal(availabilityShiftFrom({ injuries: 1, suspensions: 0 }, { injuries: 4, suspensions: 1 }), 0.16);
  assert.equal(availabilityShiftFrom({ injuries: 20, suspensions: 0 }, { injuries: 0, suspensions: 0 }), -0.4);
  assert.equal(availabilityShiftFrom({ injuries: 2, suspensions: 0 }, { injuries: 2, suspensions: 0 }), 0);
  assert.equal(eloGap({ elo: 1700 } as never, { elo: 1650 } as never), 50); assert.equal(eloGap(null, null), null);
});
