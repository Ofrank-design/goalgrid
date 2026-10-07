import test from "node:test";
import assert from "node:assert/strict";
import { z } from "zod";
import { CircuitBreaker } from "../src/lib/providers/breaker";
import { retryAfterMs } from "../src/lib/providers/retry";
import { budgetFor } from "../src/lib/providers/budget-config";
import { checkItems } from "../src/lib/providers/validate-core";

test("circuit breaker opens after repeated failures, probes once, then recovers or re-opens with a longer cooldown", () => {
  const b = new CircuitBreaker(3, 1000, 8000), k = "p";
  assert.equal(b.allow(k, 0), true);
  b.failure(k, 0); b.failure(k, 0); assert.equal(b.allow(k, 0), true, "still closed below the threshold");
  b.failure(k, 0); assert.equal(b.allow(k, 500), false, "open: fail fast"); assert.equal(b.isOpen(k, 500), true);
  assert.equal(b.allow(k, 1000), true, "cooldown over: one probe allowed"); assert.equal(b.allow(k, 1000), false, "only one probe at a time");
  b.failure(k, 1000); assert.equal(b.allow(k, 2500), false, "failed probe re-opens with a doubled cooldown (2000ms)"); assert.equal(b.allow(k, 3000), true);
  b.success(k); assert.equal(b.allow(k, 3001), true); assert.equal(b.isOpen(k, 3001), false, "success closes the circuit");
  for (let i = 0; i < 3; i++) b.failure(k, 4000); b.allow(k, 5000); b.failure(k, 5000); b.allow(k, 7000); b.failure(k, 7000); b.allow(k, 11000); b.failure(k, 11000);
  assert.equal(b.allow(k, 11000 + 8000 - 1), false, "cooldown is capped at the maximum"); assert.equal(b.allow(k, 11000 + 8000), true);
  assert.equal(b.allow("other", 0), true, "circuits are independent per provider");
});

test("Retry-After accepts seconds or a date, and is capped", () => {
  assert.equal(retryAfterMs("2"), 2000); assert.equal(retryAfterMs("120"), 5000, "capped at 5s");
  assert.equal(retryAfterMs("Wed, 07 Oct 2026 00:00:03 GMT", Date.parse("2026-10-07T00:00:00Z")), 3000);
  assert.equal(retryAfterMs(null), null); assert.equal(retryAfterMs("soon"), null); assert.equal(retryAfterMs("-5"), null);
});

test("credit budgets: defaults, per-provider overrides, legacy odds variable, 0 disables", () => {
  assert.equal(budgetFor("odds-api", {}), 16); assert.equal(budgetFor("serpapi", {}), 3); assert.equal(budgetFor("sportmonks", {}), 0, "uncapped without a setting");
  assert.equal(budgetFor("odds-api", { ODDS_DAILY_CREDIT_BUDGET: "30" }), 30);
  assert.equal(budgetFor("odds-api", { PROVIDER_BUDGET_ODDS_API: "8", ODDS_DAILY_CREDIT_BUDGET: "30" }), 8, "new variable wins");
  assert.equal(budgetFor("sportmonks", { PROVIDER_BUDGET_SPORTMONKS: "5000" }), 5000);
  assert.equal(budgetFor("newsapi", { PROVIDER_BUDGET_NEWSAPI: "0" }), 0, "0 removes the default cap"); assert.equal(budgetFor("newsapi", { PROVIDER_BUDGET_NEWSAPI: "junk" }), 0);
});

test("response validation drops bad items, and trips when the format has changed", () => {
  const schema = z.object({ id: z.number(), name: z.string() }).passthrough();
  const good = (i: number) => ({ id: i, name: `t${i}`, extra: true });
  const one = checkItems([good(1), good(2), { id: "x" }, good(4), good(5)], schema);
  assert.deepEqual([one.ok.length, one.dropped, one.tripped], [4, 1, false]); assert.match(one.firstIssue, /id/);
  assert.equal((one.ok[0] as unknown as { extra: boolean }).extra, true, "unknown fields pass through");
  const changed = checkItems([{ id: "a" }, { id: "b" }, { id: "c" }, good(1)], schema); assert.equal(changed.tripped, true, "most items invalid means the format changed");
  assert.equal(checkItems([{ id: "a" }, { id: "b" }], schema).tripped, false, "tiny lists never trip");
  assert.equal(checkItems([], schema).tripped, false);
});

import { challengeCompletions, groupBy } from "../src/lib/community/settle-logic";
test("challenge completion needs every pick settled, and sums points", () => {
  const ch = [{ id: "c1", title: "Week 1" }, { id: "c2", title: "Empty" }];
  const matches = groupBy([{ c: "c1", m: "m1" }, { c: "c1", m: "m2" }], r => r.c, r => r.m);
  const entries = groupBy([{ c: "c1", u: "a" }, { c: "c1", u: "b" }, { c: "c1", u: "c" }, { c: "c2", u: "a" }], r => r.c, r => r.u);
  const picks = [
    { user_id: "a", match_id: "m1", settled_at: "t", points: 3 }, { user_id: "a", match_id: "m2", settled_at: "t", points: 1 },
    { user_id: "b", match_id: "m1", settled_at: "t", points: 2 }, { user_id: "b", match_id: "m2", settled_at: null, points: null },
    { user_id: "c", match_id: "m1", settled_at: "t", points: 5 },
  ];
  assert.deepEqual(challengeCompletions(ch, matches, entries, picks), [{ challengeId: "c1", title: "Week 1", userId: "a", points: 4 }]);
});
