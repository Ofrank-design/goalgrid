/**
 * A first-in-first-out queue that starts its jobs at least `gapMs` apart. Batch sync jobs (warming every competition's teams)
 * run through it so a burst of work can never trip a provider's per-minute limit. football-data.org's free tier allows
 * 10 requests a minute, so 6.5 seconds between requests stays safely under it.
 *
 * It lives in one server process. Across several instances each keeps its own gap, which is why the shared token bucket in
 * limiter.ts still guards every call too.
 */
export class ThrottleQueue {
  private tail: Promise<unknown> = Promise.resolve();
  private lastStart = Number.NEGATIVE_INFINITY;
  constructor(private readonly gapMs: number, private readonly now: () => number = Date.now, private readonly sleep: (ms: number) => Promise<void> = (ms) => new Promise((r) => setTimeout(r, ms))) {}
  run<T>(job: () => Promise<T>): Promise<T> {
    const result = this.tail.then(async () => {
      const wait = this.lastStart + this.gapMs - this.now();
      if (wait > 0) await this.sleep(wait);
      this.lastStart = this.now();
      return job();
    });
    this.tail = result.catch(() => undefined);
    return result;
  }
}
export const FOOTBALL_DATA_GAP_MS = 6_500;
export const footballDataBatch = new ThrottleQueue(FOOTBALL_DATA_GAP_MS);
