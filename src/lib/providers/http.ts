import "server-only";
import { log } from "@/lib/logging/logger";
import { CircuitBreaker } from "./breaker";
import { retryAfterMs } from "./retry";
import { ProviderError, type ProviderId } from "./types";
type Opts = { provider: ProviderId; url: string; headers?: Record<string, string>; timeoutMs?: number; retries?: number; method?: "GET" | "POST"; body?: string };

const breaker = new CircuitBreaker();
const sleep = (ms: number) => new Promise<void>(r => setTimeout(r, ms));
/** Exponential backoff with jitter, so many callers retrying a struggling provider do not all hit it at the same instant. */
const backoffMs = (attempt: number) => Math.round(400 * 2 ** attempt * (0.75 + Math.random() * 0.5));
/** Failures that say the provider is unhealthy count toward opening the circuit. Bad credentials or a bad request are our problem, not an outage. */
const countsAsOutage = (e: ProviderError) => e.kind === "timeout" || e.kind === "network" || e.kind === "rate_limited" || (e.kind === "bad_response" && (e.status ?? 0) >= 500);

/** Shared fetch: circuit breaker, timeout, bounded retry with jittered backoff (honouring Retry-After), typed errors, no secrets in logs. */
export async function providerFetch<T>(opts: Opts): Promise<{ json: T; latencyMs: number }> {
  const { provider } = opts;
  if (!breaker.allow(provider)) throw new ProviderError(provider, "circuit_open", "Provider temporarily unavailable");
  try { const r = await attempt<T>(opts); breaker.success(provider); return r; }
  catch (e) { if (e instanceof ProviderError && countsAsOutage(e)) breaker.failure(provider); else if (e instanceof ProviderError) breaker.success(provider); throw e; }
}

async function attempt<T>({ provider, url, headers, timeoutMs = 8000, retries = 2, method = "GET", body }: Opts): Promise<{ json: T; latencyMs: number }> {
  for (let n = 0; ; n++) {
    const started = Date.now(), ctl = new AbortController(), timer = setTimeout(() => ctl.abort(), timeoutMs);
    try {
      const res = await fetch(url, { method, headers, body, signal: ctl.signal, cache: "no-store" });
      if (res.status === 401 || res.status === 403) throw new ProviderError(provider, "auth", "Provider rejected credentials", res.status);
      if ((res.status === 429 || res.status >= 500) && n < retries) { await sleep(retryAfterMs(res.headers.get("retry-after")) ?? backoffMs(n)); continue; }
      if (res.status === 429) throw new ProviderError(provider, "rate_limited", "Rate limited", 429);
      if (!res.ok) throw new ProviderError(provider, "bad_response", `HTTP ${res.status}`, res.status);
      return { json: (await res.json()) as T, latencyMs: Date.now() - started };
    } catch (e) {
      if (e instanceof ProviderError) { log.warn("provider error", { provider, kind: e.kind, status: e.status }); throw e; }
      if (n < retries) { await sleep(backoffMs(n)); continue; }
      const kind = (e as Error).name === "AbortError" ? "timeout" : "network";
      log.warn("provider error", { provider, kind }); throw new ProviderError(provider, kind, kind);
    } finally { clearTimeout(timer); }
  }
}
