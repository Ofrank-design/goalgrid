import test from "node:test";
import assert from "node:assert/strict";
import { SlidingWindow, limitFor } from "../src/lib/security/ratelimit";
import { sameOrigin } from "../src/lib/security/origin";
import { bearerOk, safeEqual } from "../src/lib/security/bearer";
import { scanText } from "../src/lib/security/secrets";
import { checkEnv } from "../src/lib/security/envcheck";
test("sliding window blocks the burst, reports a wait, then recovers", () => {
  const w = new SlidingWindow(); for (let i = 0; i < 3; i++) assert.ok(w.check("a", 3, 1000, 100 + i).ok);
  const r = w.check("a", 3, 1000, 200); assert.ok(!r.ok && r.retryAfterSec >= 1); assert.ok(w.check("b", 3, 1000, 200).ok); assert.ok(w.check("a", 3, 1000, 1200).ok);
});
test("limits: most specific prefix wins and expensive routes are tighter", () => {
  assert.equal(limitFor("/api/analysis")![1], 6); assert.equal(limitFor("/api/predictions/match")![0], "/api/predictions"); assert.equal(limitFor("/api/contact")![1], 5); assert.equal(limitFor("/api/unknown")![0], "/api"); assert.equal(limitFor("/dashboard"), null); assert.equal(limitFor("/apix"), null);
});
test("origin guard", () => { assert.ok(sameOrigin("https://goalgrid.app", "goalgrid.app")); assert.ok(!sameOrigin("https://evil.test", "goalgrid.app")); assert.ok(sameOrigin(null, "goalgrid.app")); assert.ok(!sameOrigin("not a url", "goalgrid.app")); assert.ok(!sameOrigin("https://goalgrid.app", null)); });
test("constant time comparisons refuse empty and unset secrets", () => {
  assert.ok(bearerOk("Bearer s3cret", "s3cret")); assert.ok(!bearerOk("Bearer nope", "s3cret")); assert.ok(!bearerOk(null, "s3cret")); assert.ok(!bearerOk("Bearer ", "")); assert.ok(safeEqual("abc", "abc")); assert.ok(!safeEqual("abc", "abd"));
  assert.ok(!safeEqual(undefined, "anything")); assert.ok(!safeEqual("", ""));
});
test("secret scanner finds real shaped keys and ignores normal code", () => {
  const fake = ["sk-ant-" + "a1B2".repeat(8), "gsk_" + "Zz9".repeat(10), "AIza" + "x".repeat(35), "RESEND_API_KEY=" + "k".repeat(30), "-----BEGIN RSA " + "PRIVATE KEY-----"];
  for (const f of fake) assert.ok(scanText(f).length > 0, f.slice(0, 12)); assert.equal(scanText("const apiKey = env().GROQ_API_KEY; // set GROQ_API_KEY in .env.local").length, 0); assert.equal(scanText("GROQ_API_KEY=").length, 0); assert.equal(scanText("GOALGRID_UNLOCK_KEY=\nGOALGRID_UNLOCK_KEY_PREMIUM=\nCRON_SECRET=\n").length, 0);
});
test("environment check: catches the dangerous mistakes", () => {
  const good = { NEXT_PUBLIC_SUPABASE_URL: "https://x.supabase.co", NEXT_PUBLIC_SUPABASE_ANON_KEY: "a".repeat(40), SUPABASE_SERVICE_ROLE_KEY: "b".repeat(40), CRON_SECRET: "c".repeat(40), SITE_URL: "https://goalgrid.app", SPORTMONKS_API_KEY: "k".repeat(30), ADMIN_EMAILS: "a@b.com" };
  assert.deepEqual(checkEnv(good).errors, []);
  assert.ok(checkEnv({ ...good, GOALGRID_UNLOCK_KEY: undefined, GOALGRID_UNLOCK_KEY_PREMIUM: undefined }).errors.length === 0, "unlock keys are no longer required"); assert.ok(checkEnv({ ...good, CRON_SECRET: "short" }).errors.length === 1);
  assert.ok(checkEnv({ ...good, SITE_URL: "http://goalgrid.app/" }).errors.length === 1); assert.ok(checkEnv({ ...good, SPORTMONKS_API_KEY: undefined }).errors.length === 1); assert.ok(checkEnv({ ...good, CRON_SECRET: "changeme".padEnd(40, "x") }).errors.length === 1);
  assert.ok(checkEnv(good).warnings.some(w => w.includes("RESEND")));
});
