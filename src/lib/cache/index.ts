import "server-only";

type CacheEntry<T> = {
  value: T;
  freshUntil: number;
  staleUntil: number;
};

const cache = new Map<string, CacheEntry<unknown>>();
const inFlight = new Map<string, Promise<unknown>>();

/**
 * Keep provider-backed reads warm between requests. A stale value is returned
 * only when a refresh fails, which keeps a temporary provider outage from
 * breaking an otherwise healthy page.
 *
 * This cache lives in one process. A multi-instance deployment can move the
 * same contract to Redis or another shared store later.
 */
export async function cached<T>(
  key: string,
  ttlMs: number,
  staleMs: number,
  load: () => Promise<T>,
): Promise<{ value: T; stale: boolean }> {
  const now = Date.now();
  const existing = cache.get(key) as CacheEntry<T> | undefined;

  if (existing && now < existing.freshUntil) {
    return { value: existing.value, stale: false };
  }

  const pending = inFlight.get(key) as Promise<T> | undefined;
  const refresh =
    pending ??
    load()
      .then((value) => {
        const expiresAt = Date.now() + ttlMs;
        cache.set(key, {
          value,
          freshUntil: expiresAt,
          staleUntil: expiresAt + staleMs,
        });
        return value;
      })
      .finally(() => {
        inFlight.delete(key);
      });

  if (!pending) {
    inFlight.set(key, refresh);
  }

  try {
    return { value: await refresh, stale: false };
  } catch (error) {
    if (existing && now < existing.staleUntil) {
      return { value: existing.value, stale: true };
    }
    throw error;
  }
}
