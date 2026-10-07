import "server-only";

import { ProviderError, type ProviderId } from "./types";

type ProviderLimit = {
  max: number;
  perMs: number;
};

const PROVIDER_LIMITS: Partial<Record<ProviderId, ProviderLimit>> = {
  "football-data": { max: 9, perMs: 60_000 },
  sportmonks: { max: 40, perMs: 60_000 },
  "odds-api": { max: 5, perMs: 60_000 },
  oddspapi: { max: 1, perMs: 1_100 },
};

const requestTimes = new Map<ProviderId, number[]>();

export async function acquire(
  provider: ProviderId,
  maxWaitMs = 2_000,
) {
  const limit = PROVIDER_LIMITS[provider] ?? {
    max: 30,
    perMs: 60_000,
  };
  const deadline = Date.now() + maxWaitMs;

  for (;;) {
    const now = Date.now();
    const recentRequests = (requestTimes.get(provider) ?? []).filter(
      (timestamp) => now - timestamp < limit.perMs,
    );

    if (recentRequests.length < limit.max) {
      recentRequests.push(now);
      requestTimes.set(provider, recentRequests);
      return;
    }

    const waitMs = limit.perMs - (now - recentRequests[0]);
    if (now + waitMs > deadline) {
      throw new ProviderError(
        provider,
        "rate_limited",
        "Local provider rate limit reached",
      );
    }

    await new Promise<void>((resolve) => setTimeout(resolve, waitMs));
  }
}
