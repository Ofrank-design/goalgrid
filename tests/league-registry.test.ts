import test from "node:test";
import assert from "node:assert/strict";
import { LEAGUE_REGISTRY, byApiFootball, byFootballData, bySportmonks, currentSeason, leagueEntry } from "../src/lib/football/league-registry";
import { FD_COMPETITIONS } from "../src/lib/providers/football-data/normalize";
import { SM_LEAGUES } from "../src/lib/providers/sportmonks/normalize";
import { normalizeApiFootball, normalizeApiFootballHistory } from "../src/lib/providers/api-football/normalize";
import { validateMatch } from "../src/lib/engine/validation/match";

test("registry: every id is unique within its provider", () => {
  for (const key of ["slug", "fd", "af", "sm", "odds", "op"] as const) {
    const values = LEAGUE_REGISTRY.flatMap((l) => (key in l ? [(l as Record<string, unknown>)[key]] : []));
    assert.equal(new Set(values).size, values.length, key);
  }
});

test("registry: provider lists are built from it and look ids up both ways", () => {
  assert.equal(Object.keys(FD_COMPETITIONS).length, LEAGUE_REGISTRY.filter((l) => "fd" in l).length);
  assert.equal(Object.keys(SM_LEAGUES).length, LEAGUE_REGISTRY.filter((l) => "sm" in l).length);
  assert.equal(byFootballData("PL")?.slug, "premier-league");
  assert.equal(byApiFootball(39)?.slug, "premier-league");
  assert.equal(bySportmonks(501)?.slug, "scottish-premiership");
  assert.equal(byApiFootball(99999), undefined);
});

test("registry: the competitions the football-data plan covers are all present", () => {
  for (const code of ["PL", "PD", "SA", "BL1", "FL1", "ELC", "DED", "PPL", "BSA", "CL", "EC", "WC"]) assert.ok(byFootballData(code), code);
});

test("season: European seasons roll over in July, Brazil's is the calendar year", () => {
  const pl = leagueEntry("premier-league")!, br = leagueEntry("brasileirao")!;
  assert.equal(currentSeason(pl, new Date("2026-10-09T00:00:00Z")), 2026);
  assert.equal(currentSeason(pl, new Date("2027-03-01T00:00:00Z")), 2026);
  assert.equal(currentSeason(br, new Date("2027-03-01T00:00:00Z")), 2027);
});

const NOW = new Date("2026-10-09T10:00:00Z");
const af = (id: number, league: number, short: string, goals: [number | null, number | null]) => ({
  fixture: { id, date: "2026-10-10T14:00:00+00:00", timestamp: 1791640800, status: { short }, venue: { name: "Ground" } },
  league: { id: league, name: "x", round: "Regular Season - 6" },
  teams: { home: { id: 1, name: "Arsenal", logo: "h.png" }, away: { id: 2, name: "Leeds United", logo: "a.png" } },
  goals: { home: goals[0], away: goals[1] },
});

test("api-football: maps tracked competitions, drops others, reads status, round and score", () => {
  const out = normalizeApiFootball([af(1, 39, "NS", [null, null]), af(2, 999999, "NS", [null, null]), af(3, 140, "FT", [2, 1]), af(4, 78, "1H", [0, 0]), af(5, 61, "PST", [null, null])], NOW);
  assert.deepEqual(out.map((m) => m.id), ["af:1", "af:3", "af:4", "af:5"]);
  assert.equal(out[0].league.slug, "premier-league"); assert.equal(out[0].status, "scheduled"); assert.equal(out[0].matchday, 6);
  assert.equal(out[0].kickoffUtc, "2026-10-10T14:00:00.000Z"); assert.deepEqual(validateMatch(out[0]), []);
  assert.equal(out[1].status, "finished"); assert.deepEqual(out[1].score, { home: 2, away: 1 });
  assert.equal(out[2].status, "live"); assert.equal(out[3].status, "postponed");
  assert.equal(out[0].provenance.source, "api-football");
});

test("api-football: history keeps only finished matches that have a score", () => {
  const h = normalizeApiFootballHistory([af(1, 39, "FT", [3, 0]), af(2, 39, "NS", [null, null]), af(3, 39, "AET", [1, 1]), af(4, 39, "FT", [null, null])]);
  assert.equal(h.length, 2); assert.deepEqual([h[0].hg, h[0].ag], [3, 0]);
});
