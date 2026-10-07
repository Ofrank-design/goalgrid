/**
 * Smoke test against the real built app (run `npm run build` first). It starts a fake Supabase that always answers "no user, no data",
 * runs `next start`, then checks the behaviour that must never regress: pages render, signed-out visitors are refused, cross-site and
 * oversized requests are blocked, cron needs its secret, admin routes stay hidden, and rate limits trip.
 *   npm run smoke
 */
import { spawn, type ChildProcess } from "node:child_process";
import { createServer, type Server } from "node:http";
import assert from "node:assert/strict";

const APP_PORT = Number(process.env.SMOKE_PORT ?? 3210), STUB_PORT = APP_PORT + 1, BASE = `http://127.0.0.1:${APP_PORT}`;

function fakeSupabase(): Promise<Server> {
  const s = createServer((req, res) => {
    const url = req.url ?? "";
    res.setHeader("content-type", "application/json");
    if (url.startsWith("/auth/v1/user")) { res.statusCode = 401; return void res.end(JSON.stringify({ message: "no session" })); }
    if (url.includes("/rpc/take_rate_limit")) return void res.end(JSON.stringify([{ allowed: true, retry_after_seconds: 0 }]));
    res.end("[]");
  });
  return new Promise(r => s.listen(STUB_PORT, "127.0.0.1", () => r(s)));
}

async function waitReady(): Promise<void> {
  for (let i = 0; i < 60; i++) { try { if ((await fetch(`${BASE}/api/health`)).ok) return; } catch { /* not up yet */ } await new Promise(r => setTimeout(r, 500)); }
  throw new Error("app did not start within 30 seconds");
}

const post = (path: string, init: { origin?: string | null; body?: string; method?: string; headers?: Record<string, string> } = {}) =>
  fetch(BASE + path, { method: init.method ?? "POST", headers: { "content-type": "application/json", ...(init.origin === null ? {} : { origin: init.origin ?? BASE }), ...init.headers }, body: init.body ?? "{}" });

const checks: [string, () => Promise<void>][] = [
  ["health", async () => { const r = await fetch(`${BASE}/api/health`); assert.equal(r.status, 200); }],
  ["static pages render with security headers", async () => {
    for (const p of ["/about", "/pricing", "/methodology"]) assert.equal((await fetch(BASE + p)).status, 200, p);
    const r = await fetch(`${BASE}/about`); assert.ok(r.headers.get("content-security-policy"), "CSP header"); assert.ok(r.headers.get("x-content-type-options"), "nosniff header");
  }],
  ["there is no access code gateway: pricing is free and the unlock endpoint is gone", async () => {
    const r = await fetch(`${BASE}/pricing`); assert.equal(r.status, 200); const html = await r.text();
    assert.match(html, /free/i); assert.ok(!/<input[^>]*(code|unlock)|upgrade|subscribe|checkout|per month|\/mo\b|[£€]\s?\d|\$\s?\d+(\.\d\d)?\s*(\/|per)/i.test(html), "pricing page still has a gateway (code box, upgrade, checkout or a price)");
    assert.equal((await post("/api/unlock")).status, 404);
  }],
  ["unknown page is a real 404 with the not-found screen", async () => { const r = await fetch(`${BASE}/definitely-not-a-page`); assert.equal(r.status, 404); assert.match(await r.text(), /Page not found/); }],
  ["signed-out visitors are refused on every user route", async () => {
    for (const [path, method] of [["/api/profile/username", "POST"], ["/api/community/delete", "POST"], ["/api/notifications/read", "POST"], ["/api/notifications/preferences", "PATCH"], ["/api/community/posts", "POST"], ["/api/community/circles/00000000-0000-0000-0000-000000000000", "POST"], ["/api/lab/runs", "POST"]] as const) {
      const r = await post(path, { method }); assert.ok([401, 403].includes(r.status), `${method} ${path} -> ${r.status}`);
    }
    assert.equal((await fetch(`${BASE}/api/notifications`)).status, 401);
  }],
  ["admin routes look like they do not exist to non-admins", async () => {
    for (const path of ["/api/admin/run", "/api/admin/backtests", "/api/admin/moderate", "/api/admin/control-plane", "/api/lab/import"]) assert.equal((await post(path)).status, 404, path);
  }],
  ["cross-site writes are blocked before any handler runs", async () => {
    for (const path of ["/api/contact", "/api/profile/username", "/api/email/subscribe"]) assert.equal((await post(path, { origin: "https://evil.example" })).status, 403, path);
  }],
  ["oversized bodies are rejected", async () => { assert.equal((await post("/api/contact", { body: "x".repeat(70_000) })).status, 413); }],
  ["cron needs its secret", async () => {
    assert.equal((await fetch(`${BASE}/api/cron/jobs?job=refresh`)).status, 401);
    assert.equal((await fetch(`${BASE}/api/cron/jobs?job=refresh`, { headers: { authorization: "Bearer wrong" } })).status, 401);
  }],
  ["errors never echo internals", async () => {
    const r = await fetch(`${BASE}/api/cron/jobs?job=maintenance`, { headers: { authorization: "Bearer smoke-secret-0123456789" } });
    const text = await r.text(); assert.ok(!/relation|supabase|postgres|ECONN|stack/i.test(text), `leaked: ${text.slice(0, 200)}`);
  }],
  ["search is rate limited per client and says when to retry", async () => {
    // The right-most x-forwarded-for entry is what the trusted proxy saw; that is the client identity.
    const from = (ip: string, forged = "6.6.6.6") => ({ "x-forwarded-for": `${forged}, ${ip}` }); let limited: Response | null = null, ok = 0;
    for (let i = 0; i < 40 && !limited; i++) { const r = await fetch(`${BASE}/api/search?q=arsenal`, { headers: from("198.51.100.77", `10.0.0.${i}`) }); if (r.status === 429) limited = r; else if (r.status === 200) ok++; }
    assert.ok(limited, "never limited: forging the left of x-forwarded-for escaped the limiter"); assert.ok(ok >= 25 && ok <= 31, `served ${ok} before limiting`); assert.ok(Number(limited.headers.get("retry-after")) >= 1, "Retry-After");
    assert.equal((await fetch(`${BASE}/api/search?q=arsenal`, { headers: from("198.51.100.78") })).status, 200, "another client is unaffected");
  }],
  ["a client-sent x-real-ip cannot pick its own bucket off-platform", async () => {
    let limited = false; for (let i = 0; i < 70 && !limited; i++) limited = (await fetch(`${BASE}/api/notifications`, { headers: { "x-real-ip": `192.0.2.${i}`, "x-forwarded-for": "198.51.100.90" } })).status === 429;
    assert.ok(limited, "rotating x-real-ip escaped the limiter");
  }],
];

async function main() {
  if (await fetch(`${BASE}/api/health`).then(() => true, () => false)) { console.log(`Port ${APP_PORT} is already in use by another server; set SMOKE_PORT.`); process.exit(1); }
  const stub = await fakeSupabase();
  const env = { ...process.env, NODE_ENV: "production" as const, PORT: String(APP_PORT), NEXT_TELEMETRY_DISABLED: "1",
    NEXT_PUBLIC_SUPABASE_URL: `http://127.0.0.1:${STUB_PORT}`, NEXT_PUBLIC_SUPABASE_ANON_KEY: "smoke-anon", SUPABASE_SERVICE_ROLE_KEY: "smoke-service",
    CRON_SECRET: "smoke-secret-0123456789", ADMIN_EMAILS: "admin@example.invalid" };
  const app: ChildProcess = spawn("npx", ["next", "start", "-p", String(APP_PORT)], { env, stdio: ["ignore", "pipe", "pipe"], detached: true });
  let log = ""; app.stdout?.on("data", d => (log += d)); app.stderr?.on("data", d => (log += d));
  let failed = 0;
  try {
    await waitReady();
    for (const [name, fn] of checks) { try { await fn(); console.log(`ok   ${name}`); } catch (e) { failed++; console.log(`FAIL ${name}\n     ${(e as Error).message.split("\n")[0]}`); } }
  } catch (e) { failed++; console.log("FAIL startup:", (e as Error).message, "\n" + log.slice(-1500)); }
  finally { try { process.kill(-app.pid!, "SIGTERM"); } catch { app.kill("SIGTERM"); } stub.close(); }
  if (failed) { console.log(`\n${failed} smoke check(s) failed`); process.exit(1); }
  console.log(`\nall ${checks.length} smoke checks passed`);
}
void main();
