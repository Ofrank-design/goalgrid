import test from "node:test";
import assert from "node:assert/strict";
import { FORMATIONS, along, choreograph, colourDistance, formationFor, isBeatEvent, kits, positionsFor, teamVisual, textOn } from "../src/lib/simulation/visual";
import { simulateMatch } from "../src/lib/simulation/match";
import { poissonPmf } from "../src/lib/engine/models/math";
import { CLUBS } from "../src/lib/football/clubs";
const pm = (lh: number, la: number) => { const M = Array.from({ length: 9 }, (_, x) => Array.from({ length: 9 }, (_, y) => poissonPmf(x, lh) * poissonPmf(y, la))), s = M.flat().reduce((a, b) => a + b, 0); return M.map(r => r.map(v => v / s)); };
test("team visuals come from data: every club has colours, short name and crest; different clubs differ; unknown slugs get stable colours", () => {
  for (const c of CLUBS) { const v = teamVisual(c.slug); assert.match(v.primary, /^#[0-9A-Fa-f]{6}$/); assert.match(v.secondary, /^#[0-9A-Fa-f]{6}$/); assert.ok(v.shortName.length >= 2 && v.shortName.length <= 3, c.slug); assert.ok(v.crest?.startsWith("/crests/"), c.slug); }
  assert.notEqual(teamVisual("arsenal").primary, teamVisual("manchester-city").primary); assert.equal(teamVisual("arsenal").shortName, "ARS"); const u = teamVisual("fictional-fc"); assert.deepEqual(u, teamVisual("fictional-fc")); assert.equal(u.crest, null); assert.notEqual(teamVisual("fictional-fc").primary, teamVisual("another-team").primary);
});
test("kits: clashing colours are fixed for the away side, readable text colour is chosen", () => {
  const l = teamVisual("liverpool"), a = teamVisual("arsenal"), k = kits(l, a); assert.ok(colourDistance(k.home.fill, k.away.fill) >= 120); const same = kits(teamVisual("arsenal"), teamVisual("arsenal")); assert.ok(colourDistance(same.home.fill, same.away.fill) >= 120);
  assert.equal(textOn("#ffffff"), "#0b0f1a"); assert.equal(textOn("#000000"), "#ffffff"); const b = kits(teamVisual("barcelona"), teamVisual("real-madrid")); assert.ok(colourDistance(b.home.fill, b.away.fill) >= 120);
});
test("formations: eleven players each, one goalkeeper, inside the pitch, same team always gets the same one", () => {
  for (const f of FORMATIONS) { assert.equal(f.slots.length, 11, f.name); assert.equal(f.slots.filter(s => s.role === "GK").length, 1); assert.ok(f.slots.every(s => s.x >= 0 && s.x <= 100 && s.y >= 0 && s.y <= 100)); }
  assert.deepEqual(formationFor("arsenal"), formationFor("arsenal")); assert.ok(new Set(CLUBS.map(c => formationFor(c.slug).name)).size >= 3);
});
test("positioning: attacking pushes up, defending drops back, ball pulls the shape, losing late pushes forward, away side is mirrored, everyone stays on the pitch", () => {
  const f = FORMATIONS[0], avg = (p: { x: number }[]) => p.slice(1).reduce((a, q) => a + q.x, 0) / 10, ball = { x: 55, y: 50 };
  const att = positionsFor(f, "home", ball, "attack", 0, 30), def = positionsFor(f, "home", ball, "defend", 0, 30), cnt = positionsFor(f, "home", ball, "counter", 0, 30); assert.ok(avg(att) > avg(def) + 8); assert.ok(avg(cnt) > avg(att));
  const behind = positionsFor(f, "home", ball, "neutral", -1, 88), level = positionsFor(f, "home", ball, "neutral", 0, 88), ahead = positionsFor(f, "home", ball, "neutral", 1, 88); assert.ok(avg(behind) > avg(level) && avg(level) > avg(ahead));
  const wide = positionsFor(f, "home", { x: 55, y: 90 }, "attack", 0, 30), centre = positionsFor(f, "home", { x: 55, y: 10 }, "attack", 0, 30); assert.ok(wide[1].y !== centre[1].y);
  const away = positionsFor(f, "away", ball, "attack", 0, 30); const mirror = positionsFor(f, "home", { x: 45, y: 50 }, "attack", 0, 30); assert.ok(Math.abs(avg(away) - (100 - avg(mirror))) < 1e-9); assert.ok(away.every((p, i) => Math.abs(p.x - (100 - mirror[i].x)) < 1e-9 && Math.abs(p.y - (100 - mirror[i].y)) < 1e-9)); for (const p of [...att, ...def, ...cnt, ...away]) assert.ok(p.x >= 0 && p.x <= 100 && p.y >= 0 && p.y <= 100);
  assert.deepEqual(positionsFor(f, "home", ball, "attack", 0, 30), att);
});
test("choreography: driven only by the engine's events, deterministic, goals end in the net, one beat per event, numbers valid, no player names anywhere", () => {
  const M = pm(1.8, 1.3), hf = FORMATIONS[0], af = FORMATIONS[2];
  for (let i = 0; i < 80; i++) { const sim = simulateMatch(M, { home: 1.8, away: 1.3 }, `V${i}`), segs = choreograph(sim, hf, af), again = choreograph(sim, hf, af); assert.deepEqual(segs, again);
    const beats = segs.flatMap(s => (s.type === "beat" ? [s.beat] : [])), want = sim.events.filter(isBeatEvent); assert.equal(beats.length, want.length); assert.deepEqual(beats.map(b => b.seq), want.map(e => e.seq)); for (let k = 1; k < beats.length; k++) assert.ok(beats[k].t >= beats[k - 1].t);
    for (const b of beats) { assert.ok(b.path.length >= 1 && b.path.every(p => p.x >= -1 && p.x <= 101 && p.y >= -1 && p.y <= 101)); if (b.kind === "goal") { const e = b.path[b.path.length - 1]; assert.equal(e.x, b.team === "home" ? 100 : 0); assert.ok(e.y >= 44 && e.y <= 56); assert.equal(b.banner, "GOAL"); } }
    assert.equal(beats.filter(b => b.kind === "goal").length, sim.final.home + sim.final.away); for (const t of ["home", "away"] as const) { const s = beats.filter(b => b.kind === "substitution" && b.team === t); assert.equal(s.length, sim.stats[t].substitutions); assert.equal(new Set(s.map(b => b.sub!.slot)).size, s.length); assert.ok(s.every(b => b.sub!.slot >= 1 && b.sub!.slot <= 10 && b.sub!.onNumber >= 12 && b.sub!.onNumber <= 16)); }
    for (const s of segs) if (s.type === "spell") { assert.ok(s.spell.toT > s.spell.fromT && s.spell.path.every(p => p.x >= 0 && p.x <= 100 && p.y >= 0 && p.y <= 100)); }
    assert.ok(!/[A-Z][a-z]+ [A-Z][a-z]+/.test(JSON.stringify(beats.map(b => b.detail)))); }
});
test("choreography leaves the engine alone: same seed gives the same match whether or not it is visualised", () => { const M = pm(1.5, 1.2), a = simulateMatch(M, { home: 1.5, away: 1.2 }, "KEEP"); choreograph(a, FORMATIONS[0], FORMATIONS[1]); assert.deepEqual(a, simulateMatch(M, { home: 1.5, away: 1.2 }, "KEEP")); });
test("along: moves along a polyline", () => { const p = [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }]; assert.deepEqual(along(p, 0), { x: 0, y: 0 }); assert.deepEqual(along(p, 0.5), { x: 10, y: 0 }); assert.deepEqual(along(p, 1), { x: 10, y: 10 }); assert.deepEqual(along([{ x: 3, y: 4 }], 0.7), { x: 3, y: 4 }); });

import { explainResult } from "../src/lib/simulation/explain";
test("explanation uses only simulation numbers and flags unlikely results", () => {
  const sim = simulateMatch(pm(1.6, 1.1), { home: 1.6, away: 1.1 }, "WHY"), l = explainResult({ home: "Arsenal", away: "Liverpool", final: sim.final, stats: sim.stats, xg: { home: 1.6, away: 1.1 }, chances: { home: 0.46, draw: 0.26, away: 0.28 } }); assert.ok(l.length >= 5 && l[0].startsWith(`Arsenal ${sim.final.home} – ${sim.final.away} Liverpool`)); assert.ok(l.some(x => x.includes(`${sim.stats.home.shots} (${sim.stats.home.shotsOnTarget} on target)`))); assert.match(l[l.length - 1], /synthetic/);
  const rare = explainResult({ home: "A", away: "B", final: { home: 0, away: 3 }, stats: sim.stats, xg: { home: 1.6, away: 1.1 }, chances: { home: 0.5, draw: 0.3, away: 0.1 } }); assert.match(rare[0], /unlikely/); assert.ok(!/because|due to|caused/i.test(l.join(" ")));
});
