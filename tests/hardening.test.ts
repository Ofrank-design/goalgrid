import test from "node:test";
import assert from "node:assert/strict";
import { clientIp } from "../src/lib/security/ip";
import { storedIsUsable, STORED_MAX_AGE_MS } from "../src/lib/engine/predictions/freshness";
import { TtlCache } from "../src/lib/cache/ttl";
import { SlidingWindow, limitFor } from "../src/lib/security/ratelimit";

const h = (o: Record<string, string>) => ({ get: (k: string) => o[k.toLowerCase()] ?? null });

test("clientIp trusts platform headers only on Vercel, and reads x-forwarded-for from the right", () => {
  assert.equal(clientIp(h({ "x-vercel-forwarded-for": "203.0.113.9", "x-forwarded-for": "1.1.1.1, 2.2.2.2" }), 1, true), "203.0.113.9");
  assert.equal(clientIp(h({ "x-real-ip": "198.51.100.4" }), 1, true), "198.51.100.4");
  // Not on Vercel: a client-supplied x-real-ip must not choose its own bucket.
  assert.equal(clientIp(h({ "x-real-ip": "6.6.6.6", "x-forwarded-for": "203.0.113.50" }), 1, false), "203.0.113.50");
  assert.equal(clientIp(h({ "x-real-ip": "6.6.6.6" }), 1, false), "unknown");
  // The client sent "6.6.6.6" and the one trusted proxy appended the address it saw.
  assert.equal(clientIp(h({ "x-forwarded-for": "6.6.6.6, 203.0.113.50" }), 1, false), "203.0.113.50");
  assert.equal(clientIp(h({ "x-forwarded-for": "6.6.6.6, 203.0.113.50, 10.0.0.2" }), 2, false), "203.0.113.50");
  assert.equal(clientIp(h({ "x-forwarded-for": "203.0.113.50" }), 1, false), "203.0.113.50");
  assert.equal(clientIp(h({}), 1, false), "unknown");
  assert.equal(clientIp(h({ "x-forwarded-for": "9.9.9.9" }), 0, false), "9.9.9.9", "nonsense hop counts fall back to 1");
});

test("stored predictions: frozen after kickoff, fresh and same-version before it", () => {
  const now = Date.parse("2026-10-06T12:00:00Z"), future = { status: "scheduled", kickoffUtc: "2026-10-06T19:00:00Z" };
  const fresh = { engineVersion: "v1", builtAt: new Date(now - 10 * 60_000).toISOString() };
  assert.equal(storedIsUsable(fresh, future, "v1", now), true);
  assert.equal(storedIsUsable({ ...fresh, builtAt: new Date(now - STORED_MAX_AGE_MS - 1000).toISOString() }, future, "v1", now), false, "too old");
  assert.equal(storedIsUsable(fresh, future, "v2", now), false, "engine version changed");
  assert.equal(storedIsUsable({ ...fresh, builtAt: new Date(now + 60_000).toISOString() }, future, "v1", now), false, "built in the future is untrustworthy");
  const old = { engineVersion: "v0", builtAt: new Date(now - 5 * 86_400_000).toISOString() };
  assert.equal(storedIsUsable(old, { status: "finished", kickoffUtc: "2026-10-05T19:00:00Z" }, "v1", now), true, "finished: frozen, always served");
  assert.equal(storedIsUsable(old, { status: "live", kickoffUtc: "2026-10-06T11:00:00Z" }, "v1", now), true, "live: frozen");
  assert.equal(storedIsUsable(old, { status: "scheduled", kickoffUtc: "2026-10-06T11:59:00Z" }, "v1", now), true, "kickoff passed: frozen");
});

test("TtlCache expires, bounds its size and shares in-flight work", async () => {
  const c = new TtlCache<number>(1000, 3);
  c.set("a", 1, 0); assert.equal(c.get("a", 999), 1); assert.equal(c.get("a", 1000), undefined);
  for (const [i, k] of ["a", "b", "c", "d"].entries()) c.set(k, i, 0);
  assert.equal(c.get("a", 1), undefined, "oldest entry evicted at capacity"); assert.equal(c.get("d", 1), 3);
  let calls = 0; const slow = () => new Promise<number>(r => setTimeout(() => { calls++; r(7); }, 10));
  const [x, y] = await Promise.all([c.remember("k", slow), c.remember("k", slow)]);
  assert.deepEqual([x, y, calls], [7, 7, 1]);
  await assert.rejects(c.remember("bad", () => Promise.reject(new Error("no"))));
  assert.equal(c.get("bad"), undefined, "failures are not cached");
});

test("middleware limits: search, notifications and challenges have their own tighter buckets", () => {
  assert.deepEqual(limitFor("/api/search"), ["/api/search", 30, 60_000]);
  assert.equal(limitFor("/api/notifications/read")![0], "/api/notifications");
  assert.equal(limitFor("/api/challenges/abc")![0], "/api/challenges");
  assert.equal(limitFor("/api/something-else")![0], "/api");
  const w = new SlidingWindow(); for (let i = 0; i < 3; i++) assert.equal(w.check("k", 3, 1000, i).ok, true);
  const blocked = w.check("k", 3, 1000, 10); assert.equal(blocked.ok, false); assert.ok(blocked.retryAfterSec >= 1);
  assert.equal(w.check("k", 3, 1000, 1500).ok, true, "window slides");
});
