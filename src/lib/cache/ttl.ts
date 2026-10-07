/** Small bounded in-memory cache with expiry. Per server instance, so use it to soften load on paid providers, not as a source of truth. */
export class TtlCache<V> {
  private store = new Map<string, { value: V; expires: number }>();
  constructor(private ttlMs: number, private maxEntries = 500) {}
  get(key: string, now = Date.now()): V | undefined {
    const hit = this.store.get(key);
    if (!hit) return undefined;
    if (hit.expires <= now) { this.store.delete(key); return undefined; }
    return hit.value;
  }
  set(key: string, value: V, now = Date.now()): void {
    if (this.store.size >= this.maxEntries) {
      for (const [k, v] of this.store) if (v.expires <= now) this.store.delete(k);
      while (this.store.size >= this.maxEntries) this.store.delete(this.store.keys().next().value as string);
    }
    this.store.delete(key);
    this.store.set(key, { value, expires: now + this.ttlMs });
  }
  /** Returns the cached value or computes it once. Concurrent callers for the same key share one in-flight call. */
  private inflight = new Map<string, Promise<V>>();
  async remember(key: string, compute: () => Promise<V>): Promise<V> {
    const cached = this.get(key); if (cached !== undefined) return cached;
    const pending = this.inflight.get(key); if (pending) return pending;
    const run = compute().then(v => { this.set(key, v); return v; }).finally(() => this.inflight.delete(key));
    this.inflight.set(key, run);
    return run;
  }
}
