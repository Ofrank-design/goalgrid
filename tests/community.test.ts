import test from "node:test";
import assert from "node:assert/strict";
import { REPORT_HIDE_THRESHOLD, parseBlocked, validUsername, validateBody } from "../src/lib/community/rules";
import { outcomeOf, pickPoints } from "../src/lib/community/scoring";
test("body rules: trims, limits, spam and blocked terms", () => {
  assert.deepEqual(validateBody("  great match \n\n\n\nyes  "), { ok: true, text: "great match \n\nyes" }); assert.ok(!validateBody("   ").ok); assert.ok(!validateBody(42 as never).ok); assert.ok(!validateBody("x".repeat(501)).ok);
  assert.ok(!validateBody("see http://a.com http://b.com www.c.com").ok); assert.ok(validateBody("see http://a.com").ok); assert.ok(!validateBody("goooooooooooooal".replace(/o+/, "o".repeat(12))).ok);
  assert.ok(!validateBody("this is BadWord here", parseBlocked(" badword , ")).ok); assert.equal(REPORT_HIDE_THRESHOLD, 3);
});
test("usernames", () => { assert.ok(validUsername("goal_fan9")); assert.ok(!validUsername("ab")); assert.ok(!validUsername("Has Space")); assert.ok(!validUsername("UPPER")); assert.ok(!validUsername("a".repeat(21))); });
test("scoring rewards calibration", () => {
  assert.equal(outcomeOf(2, 1), "home"); assert.equal(outcomeOf(1, 1), "draw"); assert.equal(outcomeOf(0, 3), "away");
  const rightHigh = pickPoints("home", 90, "home"), rightLow = pickPoints("home", 50, "home"), wrongHigh = pickPoints("home", 90, "away"), wrongLow = pickPoints("home", 50, "away");
  assert.ok(rightHigh > rightLow && rightLow > 0); assert.ok(wrongHigh < wrongLow && wrongLow < 0); assert.ok(Math.abs(wrongHigh) > rightHigh);
  assert.equal(pickPoints("home", 200, "home"), pickPoints("home", 95, "home")); assert.ok(Math.abs(pickPoints("draw", 40, "home") - pickPoints("draw", 40, "away")) === 0);
});
