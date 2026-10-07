import test from "node:test";
import assert from "node:assert/strict";
import { matchHref, pct, safeNext, shiftDate, validDate } from "../src/lib/app/format";
test("dates: validation and shifting across month and year ends", () => {
  assert.equal(validDate("2026-10-02"), "2026-10-02"); assert.equal(validDate("2026-13-40"), null); assert.equal(validDate("garbage"), null); assert.equal(validDate(undefined), null);
  assert.equal(shiftDate("2026-10-31", 1), "2026-11-01"); assert.equal(shiftDate("2026-01-01", -1), "2025-12-31");
});
test("redirect targets stay on this site", () => {
  assert.equal(safeNext("/pro"), "/pro"); assert.equal(safeNext("//evil.com"), "/dashboard"); assert.equal(safeNext("https://evil.com"), "/dashboard"); assert.equal(safeNext(null), "/dashboard");
});
test("formatting and match links", () => { assert.equal(pct(0.5449), "54%"); assert.equal(matchHref("sm:12", "2026-10-02"), "/matches/sm%3A12?date=2026-10-02"); });
