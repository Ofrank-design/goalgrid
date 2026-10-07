import "server-only";
import { takeShared } from "@/lib/security/limits";
import { ProviderError, type ProviderId } from "./types";
import { budgetFor } from "./budget-config";

/**
 * Credit budget per provider over a rolling 24 hours, shared by every server instance through Postgres (falls back to a per-instance count if
 * the database is unreachable, never to "unlimited"). Set PROVIDER_BUDGET_<ID> to change a limit, e.g. PROVIDER_BUDGET_SPORTMONKS=5000, or 0 to disable the cap.
 * Providers without a default are uncapped until you set one. ODDS_DAILY_CREDIT_BUDGET is still honoured for the odds provider.
 */
/** Spends `cost` credits or throws. Each credit is one counted event, so a call that does not fit is refused before any request is sent. */
export async function spendCredits(provider: ProviderId, cost = 1): Promise<void> {
  const cap = budgetFor(provider); if (!cap) return;
  for (let i = 0; i < cost; i++) { const r = await takeShared(`budget:${provider}`, cap, 86_400); if (!r.ok) throw new ProviderError(provider, "rate_limited", "Daily credit budget reached"); }
}
