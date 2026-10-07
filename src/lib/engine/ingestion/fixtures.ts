import "server-only";

import { cached } from "@/lib/cache";
import { validateMatch } from "@/lib/engine/validation/match";
import { log } from "@/lib/logging/logger";
import { footballData } from "@/lib/providers/football-data";
import { recordHealth } from "@/lib/providers/health";
import { ProviderError } from "@/lib/providers/types";
import { sportmonks } from "@/lib/providers/sportmonks";
import type { Match, Source } from "@/types/football";

const PROVIDERS = [sportmonks, footballData];

export interface FixturesResult {
  matches: Match[];
  source: Source | null;
  stale: boolean;
  attempts: {
    provider: string;
    ok: boolean;
    error?: string;
  }[];
}

async function loadFixtures(
  date: string,
): Promise<Omit<FixturesResult, "stale">> {
  const attempts: FixturesResult["attempts"] = [];
  let emptyProvider: Source | null = null;

  for (const provider of PROVIDERS) {
    if (!provider.configured()) {
      attempts.push({
        provider: provider.id,
        ok: false,
        error: "not configured",
      });
      continue;
    }

    try {
      const { data, meta } = await provider.fetch({ date });
      void recordHealth(provider.id, true, meta.latencyMs);

      const validMatches = data.filter((match) => {
        const issues = validateMatch(match);

        if (issues.length) {
          log.warn("match rejected", {
            id: match.id,
            issues,
          });
        }

        return issues.length === 0;
      });

      attempts.push({ provider: provider.id, ok: true });

      if (validMatches.length) {
        return {
          matches: validMatches.sort((a, b) =>
            a.kickoffUtc.localeCompare(b.kickoffUtc),
          ),
          source: provider.id as Source,
          attempts,
        };
      }

      emptyProvider ??= provider.id as Source;
    } catch (error) {
      const errorKind =
        error instanceof ProviderError ? error.kind : "unknown";

      void recordHealth(provider.id, false, undefined, errorKind);
      attempts.push({
        provider: provider.id,
        ok: false,
        error: errorKind,
      });
    }
  }

  if (emptyProvider) {
    return {
      matches: [],
      source: emptyProvider,
      attempts,
    };
  }

  throw new Error("All fixture providers failed");
}

export async function getFixtures(date: string): Promise<FixturesResult> {
  const { value, stale } = await cached(
    `fixtures:${date}`,
    5 * 60_000,
    60 * 60_000,
    () => loadFixtures(date),
  );

  return {
    ...value,
    stale,
  };
}
