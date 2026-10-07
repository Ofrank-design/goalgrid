import test from "node:test";
import assert from "node:assert/strict";
import { makeRng, newSeedLike, poissonSample, validSeed } from "./sim-helpers";
import { liveProbs, runMany, scoreAt, simulateMatch } from "../src/lib/simulation/match";
import { simulateSeasons } from "../src/lib/simulation/season";
import { poissonPmf } from "../src/lib/engine/models/math";
import { summarize } from "../src/lib/engine/scenarios";
const pm = (lh: number, la: number) => { const M = Array.from({ length: 9 }, (_, x) => Array.from({ length: 9 }, (_, y) => poissonPmf(x, lh) * poissonPmf(y, la))), s = M.flat().reduce((a, b) => a + b, 0); return M.map(r => r.map(v => v / s)); };
test("rng: same seed same numbers, different seed different, values in [0,1)", () => { const a = makeRng("8F2A91D7"), b = makeRng("8F2A91D7"), c = makeRng("8F2A91D8"); const A = Array.from({ length: 50 }, a), B = Array.from({ length: 50 }, b), C = Array.from({ length: 50 }, c); assert.deepEqual(A, B); assert.notDeepEqual(A, C); assert.ok(A.every(x => x >= 0 && x < 1)); assert.ok(validSeed("8F2A91D7") && !validSeed("") && !validSeed("a b") && !validSeed("x".repeat(17)) && newSeedLike().length === 8); });
test("poisson sampler has the right mean", () => { const r = makeRng("p"); const m = Array.from({ length: 20000 }, () => poissonSample(r, 1.7)).reduce((a, b) => a + b, 0) / 20000; assert.ok(Math.abs(m - 1.7) < 0.05, String(m)); });
test("match: same seed reproduces the whole match exactly", () => { const M = pm(1.6, 1.1), a = simulateMatch(M, { home: 1.6, away: 1.1 }, "ABC123"), b = simulateMatch(M, { home: 1.6, away: 1.1 }, "ABC123"); assert.deepEqual(a, b); assert.notDeepEqual(a.events, simulateMatch(M, { home: 1.6, away: 1.1 }, "ABC124").events); });
test("match: events agree with the final score and the statistics, in order", () => {
  const M = pm(1.6, 1.1); for (let i = 0; i < 200; i++) { const m = simulateMatch(M, { home: 1.6, away: 1.1 }, `S${i}`), g = (t: "home" | "away") => m.events.filter(e => e.type === "goal" && e.team === t).length;
    assert.equal(g("home"), m.final.home); assert.equal(g("away"), m.final.away); const last = m.events[m.events.length - 1]; assert.equal(last.type, "full_time"); assert.deepEqual(last.score, m.final); for (let k = 1; k < m.events.length; k++) assert.ok(m.events[k].t >= m.events[k - 1].t && m.events[k].seq === k + 1);
    for (const t of ["home", "away"] as const) { const s = m.stats[t]; assert.ok(s.shots >= s.shotsOnTarget && s.shotsOnTarget >= m.final[t]); assert.equal(m.events.filter(e => e.team === t && (e.type === "goal" || e.type === "shot_on_target" || e.type === "shot")).length, s.shots); }
    assert.equal(m.stats.home.possession + m.stats.away.possession, 100); assert.equal(m.events.filter(e => e.type === "half_time").length, 1); assert.ok(m.addedTime >= 2 && m.addedTime <= 6); assert.equal(scoreAt(m.events, 0).home, 0); }
});
test("live probabilities: sum to 1, start near the pre-match chances, end at the result", () => {
  const M = pm(1.6, 1.1), m = simulateMatch(M, { home: 1.6, away: 1.1 }, "LIVE1"), base = summarize(M); const p0 = m.liveProbabilities[0]; assert.ok(Math.abs(p0.home - base.home) < 0.03 && Math.abs(p0.draw - base.draw) < 0.03);
  for (const p of m.liveProbabilities) assert.ok(Math.abs(p.home + p.draw + p.away - 1) < 0.003); const end = liveProbs(m.final.home, m.final.away, 0, 0); assert.ok(end.home === 1 || end.draw === 1 || end.away === 1); assert.ok(liveProbs(2, 0, 0.1, 0.1).home > 0.97);
});
test("many runs converge to the model probabilities and report their own sampling error", () => {
  const M = pm(1.6, 1.1), base = summarize(M), r = runMany(M, 1000, "MC1"); assert.ok(Math.abs(r.home.probability - base.home) < 0.04 && Math.abs(r.draw.probability - base.draw) < 0.04 && Math.abs(r.btts.probability - base.btts) < 0.04);
  assert.ok(r.home.margin > 0 && r.home.margin < 0.035); assert.equal(r.home.count + r.draw.count + r.away.count, 1000); assert.deepEqual(runMany(M, 500, "X"), runMany(M, 500, "X")); assert.ok(runMany(M, 100, "A").home.margin > runMany(M, 1000, "A").home.margin);
});
test("season Monte Carlo: strongest team is the favourite, probabilities are coherent and the run is reproducible", () => {
  const teams = ["a", "b", "c", "d", "e", "f"], str: Record<string, number> = { a: 1.5, b: 1.2, c: 1, d: 0.9, e: 0.8, f: 0.6 }, rates = (h: string, a: string) => ({ lh: 1.4 * str[h] / str[a] ** 0.5 * 0.9, la: 1.1 * str[a] / str[h] ** 0.5 * 0.9 });
  const r = simulateSeasons({ teams, rates }, 800, "SEASON1", { topN: 2, relegated: 2 })!; assert.ok(r); assert.equal(r.teams[0].team, "a"); assert.ok(Math.abs(r.teams.reduce((s, t) => s + t.title, 0) - 1) < 1e-3); assert.ok(Math.abs(r.teams.reduce((s, t) => s + t.topFour, 0) - 2) < 1e-3);
  assert.ok(r.teams.find(t => t.team === "a")!.title > r.teams.find(t => t.team === "f")!.title); assert.ok(r.teams.find(t => t.team === "f")!.relegation > r.teams.find(t => t.team === "a")!.relegation); assert.deepEqual(simulateSeasons({ teams, rates }, 100, "Z")!, simulateSeasons({ teams, rates }, 100, "Z")!);
  for (const t of r.teams) assert.ok(Math.abs(t.positions.reduce((a, b) => a + b, 0) - 1) < 1e-3); assert.equal(simulateSeasons({ teams, rates: () => null }, 10, "x"), null);
});

import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
const walk = (d: string): string[] => readdirSync(d).flatMap(f => { const p = join(d, f); return statSync(p).isDirectory() ? walk(p) : [p]; });
test("isolation: simulation code never reads or writes real prediction, leaderboard, trophy or result tables, and no real prediction code reads simulation tables", () => {
  const sim = [...walk("src/lib/simulation"), ...walk("src/app/api/simulation"), ...walk("src/app/(app)/simulation")].filter(f => /\.tsx?$/.test(f)), banned = /\.from\("(user_predictions|user_market_picks|prediction_versions|prediction_snapshots|leaderboard\w*|user_trophies|trophy_award_audits|posts|community_booking_posts|matches)"\)|@\/lib\/community\/(awards|settle)/;
  assert.ok(sim.length >= 10); for (const f of sim) assert.ok(!banned.test(readFileSync(f, "utf8")), `${f} touches a real-data table`);
  const real = [...walk("src/lib/community"), ...walk("src/lib/engine"), "src/lib/ops/jobs.ts"].filter(f => /\.ts$/.test(f)); for (const f of real) assert.ok(!/simulation_runs/.test(readFileSync(f, "utf8")), `${f} reads simulation data`);
});
test("security: the browser cannot set the score, probabilities or a seed after the run", () => {
  const m = readFileSync("src/lib/simulation/server.ts", "utf8"); assert.ok(!/final|probabilit|score/i.test(m.slice(m.indexOf("export const matchBody"), m.indexOf("\n", m.indexOf("export const matchBody")))));
  assert.match(m, /seed: z\.string\(\)\.optional\(\)/); assert.match(m, /validSeed/);
});

test("tracker extras: substitutions in the second half, positions on the pitch, goals near goal, same seed same positions", () => {
  const M = pm(1.6, 1.1); for (let i = 0; i < 100; i++) { const m = simulateMatch(M, { home: 1.6, away: 1.1 }, `T${i}`);
    for (const t of ["home", "away"] as const) { const subs = m.events.filter(e => e.type === "substitution" && e.team === t); assert.equal(subs.length, m.stats[t].substitutions); assert.ok(subs.length >= 3 && subs.length <= 5 && subs.every(e => e.t >= 46 && e.t <= 85)); }
    for (const e of m.events) { if (["goal", "shot", "shot_on_target", "corner"].includes(e.type)) { assert.ok(e.x! >= 0 && e.x! <= 100 && e.y! >= 0 && e.y! <= 100); if (e.type === "goal") assert.ok(e.team === "home" ? e.x! >= 90 : e.x! <= 10); } else assert.equal(e.x, undefined); } }
  assert.deepEqual(simulateMatch(M, { home: 1.6, away: 1.1 }, "POS"), simulateMatch(M, { home: 1.6, away: 1.1 }, "POS"));
});
