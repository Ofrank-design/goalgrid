import test from "node:test";
import assert from "node:assert/strict";
import { selectProviders } from "../src/lib/engine/ingestion/fixture-plan";

test("gap fill: a later tier is asked for leagues that still have no matches", () => {
  const P = (id: string) => ({ id, configured: () => true });
  const bb = P("big-balls"), ga = P("goal-api"), af = P("api-football");
  // Only the Premier League has matches so far: Big Balls (La Liga, Serie A, ...) and GOAL API still have leagues to fill.
  assert.deepEqual(selectProviders([bb], [], true, new Set(["premier-league"])).map(p => p.id), ["big-balls"]);
  assert.deepEqual(selectProviders([ga, af], [], true, new Set(["premier-league"])).map(p => p.id), ["goal-api", "api-football"]);
  // Every league a provider covers already has matches: no spend.
  const all = new Set(["premier-league", "la-liga", "serie-a", "bundesliga", "ligue-1"]);
  assert.deepEqual(selectProviders([bb], [], true, all), []);
  // Nothing found yet: everyone is asked, as before.
  assert.equal(selectProviders([bb, ga], [], false, new Set()).length, 2);
});
