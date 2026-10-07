/**
 * Circuit breaker, one circuit per key (provider). After `threshold` failures in a row the circuit opens and calls fail fast for a cooldown
 * that doubles each time it re-opens (capped). After the cooldown exactly one probe call is let through: success closes the circuit,
 * failure re-opens it. This stops a dead provider from soaking up every request's timeout and retries.
 */
export class CircuitBreaker {
  private circuits = new Map<string, { fails: number; opens: number; openUntil: number; probing: boolean }>();
  constructor(private threshold = 5, private baseCooldownMs = 15_000, private maxCooldownMs = 300_000) {}
  private get(key: string) { let c = this.circuits.get(key); if (!c) { c = { fails: 0, opens: 0, openUntil: 0, probing: false }; this.circuits.set(key, c); } return c; }
  allow(key: string, now = Date.now()): boolean {
    const c = this.get(key);
    if (c.openUntil === 0) return true;
    if (now < c.openUntil) return false;
    if (c.probing) return false;
    c.probing = true; return true;
  }
  success(key: string): void { this.circuits.set(key, { fails: 0, opens: 0, openUntil: 0, probing: false }); }
  failure(key: string, now = Date.now()): void {
    const c = this.get(key); c.fails++;
    if (c.probing || c.fails >= this.threshold) {
      c.opens++; c.fails = 0; c.probing = false;
      c.openUntil = now + Math.min(this.maxCooldownMs, this.baseCooldownMs * 2 ** (c.opens - 1));
    }
  }
  isOpen(key: string, now = Date.now()): boolean { const c = this.get(key); return c.openUntil !== 0 && now < c.openUntil; }
}
