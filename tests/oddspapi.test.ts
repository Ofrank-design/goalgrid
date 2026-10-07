import test from "node:test";
import assert from "node:assert/strict";
import { normalizeOddsPapi, type OpFixture } from "../src/lib/providers/oddspapi/normalize";
import { buildMarket, findOddsEvent } from "../src/lib/engine/normalization/odds";
import { normalizeFootballData } from "../src/lib/providers/football-data/normalize";
const o = (label: string, price: number, active = true) => ({ players: { "0": { active, price, bookmakerOutcomeId: label } } });
const fx: OpFixture[] = [{ fixtureId: "id1", participant1Id: 35, participant2Id: 34, startTime: "2026-10-03T14:00:00.000Z", hasOdds: true, bookmakerOdds: { pinnacle: { bookmakerIsActive: true, suspended: false, markets: {
  "101": { marketActive: true, outcomes: { "101": o("home", 2.1), "102": o("draw", 3.4), "103": o("away", 3.6) } },
  "1012": { marketActive: true, outcomes: { "1": o("2.5/over", 1.95), "2": o("2.5/under", 1.9), "3": o("3.5/over", 3.1), "4": o("3.5/under", 1.35) } },
  "999": { marketActive: true, outcomes: { "5": o("home", 1.5), "6": o("away", 2.6) } } } }, suspendedbook: { suspended: true, markets: {} } } },
  { fixtureId: "id2", participant1Id: 1, participant2Id: 2, startTime: "2026-10-03T14:00:00.000Z", bookmakerOdds: {} }];
test("oddspapi: 1X2 and 2.5 goals found by label, other markets and suspended books ignored", () => {
  const ev = normalizeOddsPapi(fx, { "35": "Manchester United", "34": "Arsenal" }); assert.equal(ev.length, 1); const b = ev[0].bookmakers; assert.equal(b.length, 1);
  assert.deepEqual(b[0].markets.map(m => m.key), ["h2h", "totals"]); assert.equal(b[0].markets[0].outcomes.length, 3); assert.equal(b[0].markets[1].outcomes[0].point, 2.5);
});
test("oddspapi events feed the same market builder as The Odds API", () => {
  const ev = normalizeOddsPapi(fx, { "35": "Manchester United", "34": "Arsenal" }), m = normalizeFootballData([{ id: 9, utcDate: "2026-10-03T14:00:00Z", status: "TIMED", homeTeam: { id: 1, name: "Manchester United FC" }, awayTeam: { id: 2, name: "Arsenal FC" }, competition: { id: 1, code: "PL", name: "PL" } }], new Date())[0];
  const e = findOddsEvent(ev, m)!; assert.ok(e); const mk = buildMarket(e)!; assert.ok(Math.abs(mk.impliedProbabilities.home + mk.impliedProbabilities.draw + mk.impliedProbabilities.away - 1) < 0.001); assert.equal(mk.bookmakers, 1);
});
