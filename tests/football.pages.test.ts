import { leagueEntry } from "../src/lib/football/league-registry";
import test from "node:test";
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { LEAGUES, searchLeagues } from "../src/lib/football/clubs";
import { computeTable, seasonStart, teamSummary } from "../src/lib/football/table";
const m = (date: string, home: string, away: string, hg: number, ag: number) => ({ date, home, away, hg, ag });
test("league search ignores case and accents", () => {
  assert.deepEqual(searchLeagues("eng").map(l => l.slug).sort(), ["championship", "premier-league"]); assert.deepEqual(searchLeagues("liga").map(l => l.slug).sort(), ["bundesliga", "danish-superliga", "la-liga", "primeira-liga"]); assert.equal(searchLeagues("a").length, 0); assert.ok(searchLeagues("BRASIL").length === 1);
  for (const l of LEAGUES.filter(l => leagueEntry(l.slug)?.image)) assert.ok(existsSync(join(process.cwd(), "public/leagues", l.slug + ".webp")), l.slug);
});
test("season start rolls over in July", () => { assert.equal(seasonStart(new Date("2026-10-03T00:00:00Z")), "2026-07-01"); assert.equal(seasonStart(new Date("2027-03-01T00:00:00Z")), "2026-07-01"); assert.equal(seasonStart(new Date("2027-07-02T00:00:00Z")), "2027-07-01"); });
const H = [m("2026-08-20", "a", "b", 2, 0), m("2026-08-27", "c", "a", 1, 1), m("2026-09-03", "b", "c", 0, 3), m("2026-09-10", "a", "c", 0, 1), m("2025-12-01", "b", "a", 9, 0)];
test("table: points, goal difference, ordering, form and old seasons ignored", () => {
  const t = computeTable(H, "2026-07-01"), by = Object.fromEntries(t.map(r => [r.slug, r]));
  assert.equal(by.a.pts, 4); assert.equal(by.a.p, 3); assert.deepEqual(by.a.form, ["W", "D", "L"]); assert.equal(by.c.pts, 7); assert.equal(by.c.gd, 4); assert.equal(by.b.pts, 0); assert.deepEqual(t.map(r => r.slug), ["c", "a", "b"]);
});
test("team summary: last five newest first, home and away split", () => {
  const s = teamSummary(H, x => x === "a", "2026-07-01"); assert.equal(s.played, 3); assert.equal(s.last[0].result, "L"); assert.equal(s.last[0].opponent, "c"); assert.deepEqual(s.home, { p: 2, w: 1, d: 0, l: 1, gf: 2, ga: 1 }); assert.deepEqual(s.away, { p: 1, w: 0, d: 1, l: 0, gf: 1, ga: 1 });
});
