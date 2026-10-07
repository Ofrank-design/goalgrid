import test from "node:test";
import assert from "node:assert/strict";
import { normalizeFootballData } from "../src/lib/providers/football-data/normalize";
import { normalizeSportmonks } from "../src/lib/providers/sportmonks/normalize";
import { teamSlug } from "../src/lib/engine/normalization/teams";
import { validateMatch } from "../src/lib/engine/validation/match";
const NOW = new Date("2026-10-01T10:00:00Z");
const fd = [{ id: 1, utcDate: "2026-10-01T19:00:00Z", status: "TIMED", matchday: 8, homeTeam: { id: 57, name: "Arsenal FC", shortName: "Arsenal", crest: "x" }, awayTeam: { id: 61, name: "Chelsea FC" }, competition: { id: 2021, code: "PL", name: "Premier League" }, score: { fullTime: { home: null, away: null } } },
  { id: 2, utcDate: "2026-10-01T19:00:00Z", status: "TIMED", homeTeam: { id: 1, name: "X" }, awayTeam: { id: 2, name: "Y" }, competition: { id: 9, code: "CL", name: "Champions League" } }];
const sm = [{ id: 10, league_id: 384, starting_at: "2026-10-01 18:45:00", participants: [{ id: 1, name: "FC Internazionale Milano", meta: { location: "home" } }, { id: 2, name: "SSC Napoli", meta: { location: "away" } }], state: { developer_name: "FT" },
  scores: [{ description: "1ST_HALF", score: { goals: 1, participant: "home" } }, { description: "CURRENT", score: { goals: 2, participant: "home" } }, { description: "CURRENT", score: { goals: 0, participant: "away" } }] }];
test("football-data: maps tracked leagues, drops others", () => {
  const m = normalizeFootballData(fd, NOW); assert.equal(m.length, 1);
  assert.equal(m[0].league.slug, "premier-league"); assert.equal(m[0].status, "scheduled"); assert.equal(m[0].home.slug, "arsenal"); assert.deepEqual(validateMatch(m[0]), []);
  assert.equal(m[0].provenance.expiresAt, "2026-10-01T10:15:00.000Z");
});
test("sportmonks: UTC kickoff, CURRENT score, finished status", () => {
  const m = normalizeSportmonks(sm, NOW)[0];
  assert.equal(m.kickoffUtc, "2026-10-01T18:45:00.000Z"); assert.equal(m.status, "finished"); assert.deepEqual(m.score, { home: 2, away: 0 });
  assert.equal(m.home.slug, "inter"); assert.equal(m.away.slug, "napoli"); assert.deepEqual(validateMatch(m), []);
});
test("entity resolution: both providers agree on a club", () => {
  assert.equal(teamSlug("FC Bayern München"), teamSlug("Bayern Munich")); assert.equal(teamSlug("Real Madrid CF"), "real-madrid"); assert.equal(teamSlug("Olympique de Marseille"), "marseille");
});
test("validation rejects bad matches", () => {
  const m = normalizeFootballData(fd, NOW)[0];
  assert.ok(validateMatch({ ...m, away: { ...m.home } }).length); assert.ok(validateMatch({ ...m, status: "finished" }).length); assert.ok(validateMatch({ ...m, kickoffUtc: "nope" }).length);
});
