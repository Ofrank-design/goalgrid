import "server-only";
import type { ZodType } from "zod";
import { log } from "@/lib/logging/logger";
import { ProviderError, type ProviderId } from "./types";
import { checkItems } from "./validate-core";

/**
 * Checks each item of a provider list against a schema that describes only the fields our adapters read. Items that do not fit are dropped
 * and logged, so one odd row never loses a whole day of fixtures. If too many fail the provider has probably changed its format, and we
 * fail loudly (bad_response) instead of silently serving a thin or corrupt result.
 */
export function validateItems<T>(provider: ProviderId, raw: unknown[], schema: ZodType<T>, minValidShare = 0.5): T[] {
  const r = checkItems(raw, schema, minValidShare);
  if (r.dropped) log.warn("provider items failed validation", { provider, dropped: r.dropped, of: raw.length, firstIssue: r.firstIssue });
  if (r.tripped) throw new ProviderError(provider, "bad_response", "Response format changed");
  return r.ok;
}
