import test from "node:test";
import assert from "node:assert/strict";
import { MOD_FLOW, VERIFY_FLOW, bookingInput, checkNote, countsTowardRecord } from "../src/lib/community/booking";
import { accountGate, can, canActOnUser, isNewAccount, reasonOk, suspendDaysAllowed } from "../src/lib/community/moderation";
import { earned, TROPHY_RULES, type TrophyBasis } from "../src/lib/community/trophies";
import { MIN_PUBLIC_SAMPLE, recordOf } from "../src/lib/community/userstats";
const pick = (i: number, ok: boolean) => ({ pick: "home", outcome: ok ? "home" : "away", points: ok ? 3 : 0, settledAt: `2026-01-${String(i + 1).padStart(2, "0")}` });
test("booking input: valid code passes; verification and moderation fields are rejected, not ignored", () => {
  assert.ok(bookingInput.safeParse({ bookingCode: "AB12-CD34" }).success); assert.ok(!bookingInput.safeParse({ bookingCode: "ab" }).success); assert.ok(!bookingInput.safeParse({ bookingCode: "<script>" }).success);
  for (const k of ["verification_status", "verified_at", "verified_by", "moderation_status", "moderation_reason", "user_id", "userId"]) assert.ok(!bookingInput.safeParse({ bookingCode: "ABC123", [k]: "verified" }).success, k);
});
test("booking note: guarantees, spam and link floods are refused", () => { assert.ok(!checkNote("this is a guaranteed win").ok); assert.ok(!checkNote("sure win tonight").ok); assert.ok(!checkNote("aaaaaaaaaaaa").ok); assert.ok(!checkNote("http://a.com http://b.com").ok); assert.ok(checkNote("Good value on the home side").ok); });
test("verification and moderation flows: only listed transitions, shares never count toward the record", () => {
  assert.deepEqual(VERIFY_FLOW.verify.from, ["pending_review"]); assert.ok(!VERIFY_FLOW.verify.from.includes("unverified" as never)); assert.ok(!MOD_FLOW.hide.from.includes("removed" as never)); assert.ok(!MOD_FLOW.restore.from.includes("active" as never));
  assert.equal(countsTowardRecord({ verification_status: "verified" }), false);
});
test("roles: moderators cannot ban or unban, admins can; staff cannot be actioned by moderators; suspension length is capped", () => {
  assert.ok(can("moderator", "suspend") && !can("moderator", "ban") && !can("moderator", "unban") && can("admin", "ban") && !can("user", "hide"));
  assert.ok(canActOnUser("moderator", "user") && !canActOnUser("moderator", "moderator") && !canActOnUser("moderator", "admin") && canActOnUser("admin", "moderator") && !canActOnUser("admin", "admin") && !canActOnUser("user", "user"));
  assert.ok(suspendDaysAllowed("moderator", 7) && !suspendDaysAllowed("moderator", 8) && suspendDaysAllowed("admin", 365) && !suspendDaysAllowed("admin", 0) && !suspendDaysAllowed("admin", 1.5));
  assert.ok(reasonOk("spam code") && !reasonOk("no") && !reasonOk(undefined));
});
test("account gate: banned and active suspensions block posting, expired suspensions and warnings do not", () => {
  const now = Date.parse("2026-10-04T00:00:00Z"); assert.equal(accountGate("banned", null, now).canPost, false); assert.equal(accountGate("suspended", "2026-10-05T00:00:00Z", now).canPost, false);
  assert.equal(accountGate("suspended", "2026-10-03T00:00:00Z", now).canPost, true); assert.equal(accountGate("warned", null, now).canPost, true); assert.equal(accountGate("active", null, now).canPost, true);
  assert.ok(isNewAccount("2026-10-03T20:00:00Z", now) && !isNewAccount("2026-10-02T00:00:00Z", now));
});
test("prediction record: voids ignored, streaks exact, accuracy hidden below the minimum sample", () => {
  const r = recordOf([...[true, true, true, false, true, true].map((ok, i) => pick(i, ok)), { pick: "home", outcome: "void", points: 0, settledAt: "2026-01-20" }]);
  assert.equal(r.evaluated, 6); assert.equal(r.correct, 5); assert.equal(r.longestStreak, 3); assert.equal(r.currentStreak, 2); assert.equal(r.points, 15); assert.ok(r.building && MIN_PUBLIC_SAMPLE === 10);
  assert.equal(recordOf([]).accuracy, 0); assert.equal(recordOf(Array.from({ length: 12 }, (_, i) => pick(i, i < 9))).building, false);
});
test("trophies: awarded from real records only, once, and never from booking data", () => {
  const base: TrophyBasis = { submitted: 0, record: recordOf([]), exactHits: 0, activePosts: 0, likesOnPosts: 0, topTen: false };
  assert.deepEqual(earned(base, []), []); const b2 = { ...base, submitted: 1 }; assert.deepEqual(earned(b2, []), ["first-kick"]); assert.deepEqual(earned(b2, ["first-kick"]), []);
  const strong = { ...base, submitted: 30, record: recordOf(Array.from({ length: 25 }, (_, i) => pick(i, i % 5 !== 4))) }; const got = earned(strong, []); for (const c of ["first-kick", "ten-match-analyst", "form-finder", "three-streak"]) assert.ok(got.includes(c), c); assert.ok(!got.includes("five-streak") === (strong.record.longestStreak < 5));
  assert.equal(TROPHY_RULES.length, 9); assert.ok(!JSON.stringify(Object.keys(base)).match(/booking|profit|stake|proof/i));
});

import { exactValue, marketPick, marketTotals, resultFor, scoreMarket } from "../src/lib/community/markets";
test("market picks: valid values only, scoring 2, 2 and 8, voids give nothing", () => {
  assert.ok(marketPick.safeParse({ market: "btts", value: "yes" }).success && !marketPick.safeParse({ market: "btts", value: "maybe" }).success && !marketPick.safeParse({ market: "over25", value: "yes" }).success);
  assert.ok(exactValue.safeParse("2-1").success && exactValue.safeParse("10-0").success && !exactValue.safeParse("2:1").success && !exactValue.safeParse("20-0").success && !exactValue.safeParse("-1-0").success && !exactValue.safeParse("1-1; drop").success);
  assert.deepEqual(scoreMarket("btts", "yes", 2, 1), { correct: true, points: 2 }); assert.deepEqual(scoreMarket("btts", "yes", 2, 0), { correct: false, points: 0 }); assert.deepEqual(scoreMarket("over25", "over", 2, 1), { correct: true, points: 2 });
  assert.deepEqual(scoreMarket("over25", "over", 1, 1), { correct: false, points: 0 }); assert.deepEqual(scoreMarket("exact", "2-1", 2, 1), { correct: true, points: 8 }); assert.deepEqual(scoreMarket("exact", "1-2", 2, 1), { correct: false, points: 0 });
  assert.equal(resultFor("btts", 0, 0), "no"); assert.equal(resultFor("over25", 3, 0), "over");
  assert.deepEqual(marketTotals([{ market: "exact", correct: true }, { market: "exact", correct: false }, { market: "btts", correct: true }]).find(t => t.market === "exact"), { market: "exact", total: 2, correct: 1 });
});
test("Exact Eye needs three exact hits", () => { const base: TrophyBasis = { submitted: 0, record: recordOf([]), exactHits: 2, activePosts: 0, likesOnPosts: 0, topTen: false }; assert.ok(!earned(base, []).includes("exact-eye")); assert.ok(earned({ ...base, exactHits: 3 }, []).includes("exact-eye")); });
