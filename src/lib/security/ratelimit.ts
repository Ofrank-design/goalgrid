/** Sliding window limiter. Memory is per server instance, so this is only the cheap first line of defence in middleware: it blunts floods before they cost a database call. Abuse-sensitive routes also call the shared Postgres limiter (security/limits.ts allowIp). */
export class SlidingWindow {
  private hits = new Map<string, number[]>();
  check(key: string, max: number, windowMs: number, now = Date.now()): { ok: boolean; retryAfterSec: number } {
    const w = (this.hits.get(key) ?? []).filter(t => now - t < windowMs);
    if (w.length >= max) { this.hits.set(key, w); return { ok: false, retryAfterSec: Math.max(1, Math.ceil((windowMs - (now - w[0])) / 1000)) }; }
    w.push(now); this.hits.set(key, w); if (this.hits.size > 20_000) for (const [k, v] of this.hits) if (!v.some(t => now - t < windowMs)) this.hits.delete(k);
    return { ok: true, retryAfterSec: 0 };
  }
}
/** First matching prefix wins. Expensive routes (language models, model fitting) get the tightest limits. */
export const LIMITS: [string, number, number][] = [["/api/analysis", 6, 60_000], ["/api/predictions", 30, 60_000], ["/api/context", 30, 60_000], ["/api/matches", 60, 60_000], ["/api/contact", 5, 3_600_000], ["/api/email", 10, 3_600_000], ["/api/community", 30, 60_000], ["/api/moderation", 30, 60_000], ["/api/lab", 30, 60_000], ["/api/simulation", 30, 60_000], ["/api/models", 20, 60_000], ["/api/predict", 30, 60_000], ["/api/profile", 10, 60_000], ["/api/admin", 30, 60_000], ["/api/search", 30, 60_000], ["/api/notifications", 60, 60_000], ["/api/challenges", 30, 60_000], ["/api", 120, 60_000]];
export const limitFor = (path: string) => LIMITS.find(([p]) => path === p || path.startsWith(p + "/")) ?? null;
