import test from "node:test";
import assert from "node:assert/strict";
import { normalizeHistory } from "../src/lib/providers/football-data/normalize";
test("history keeps finished matches with scores only", () => {
  const t = { id: 1, name: "Arsenal FC" }, u = { id: 2, name: "Chelsea FC" }, c = { id: 1, code: "PL", name: "PL" };
  const h = normalizeHistory([{ id: 1, utcDate: "2026-08-20T19:00:00Z", status: "FINISHED", homeTeam: t, awayTeam: u, competition: c, score: { fullTime: { home: 2, away: 1 } } },
    { id: 2, utcDate: "2026-08-27T19:00:00Z", status: "TIMED", homeTeam: t, awayTeam: u, competition: c, score: { fullTime: { home: null, away: null } } }]);
  assert.deepEqual(h, [{ date: "2026-08-20T19:00:00Z", home: "arsenal", away: "chelsea", hg: 2, ag: 1 }]);
});
