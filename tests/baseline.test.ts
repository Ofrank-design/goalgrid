import test from "node:test";
import assert from "node:assert/strict";
import { baselinePrediction, historyTeam, type Ensemble } from "../src/lib/engine/models/ensemble";
import { teamSlug } from "../src/lib/engine/normalization/teams";

const stub = (names: string[]) => ({ games: new Map(names.map(n => [teamSlug(n), 20])), base: { home: 0.45, draw: 0.26, away: 0.29, goalsHome: 1.5, goalsAway: 1.2 } }) as unknown as Ensemble;

test("fixture names are matched to the history's spelling of the club", () => {
  const e = stub(["FC Internazionale Milano", "1. FSV Mainz 05", "Stade Brestois 29", "Rayo Vallecano de Madrid", "TSG 1899 Hoffenheim", "Arsenal FC"]);
  for (const name of ["Inter Milan", "Mainz", "Brest", "Rayo Vallecano", "TSG Hoffenheim", "Arsenal"]) assert.ok(historyTeam(e, name, teamSlug(name)), `${name} should resolve`);
  assert.equal(historyTeam(e, "Frosinone", teamSlug("Frosinone")), null);
});

test("baseline estimate is finite, flagged, sums to one and follows bookmaker odds", () => {
  const e = stub([]), plain = baselinePrediction(e, {}, "no history");
  assert.equal(plain.baseline, true); assert.equal(plain.modelsUsed, 0); assert.ok(plain.confidence <= 25);
  const p = plain.probabilities; assert.ok(Math.abs(p.home + p.draw + p.away - 1) < 0.002);
  for (const v of [plain.btts, plain.over25, plain.expectedGoals.home, plain.expectedGoals.away, plain.mostLikelyScore.probability]) assert.ok(Number.isFinite(v));
  const fav = baselinePrediction(e, { market: { home: 0.7, draw: 0.2, away: 0.1 } }, "no history");
  assert.ok(Math.abs(fav.probabilities.home - 0.7) < 0.01); assert.ok(fav.expectedGoals.home > fav.expectedGoals.away + 0.5);
});
