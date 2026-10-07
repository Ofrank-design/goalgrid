import type { ProviderId } from "./types";

/** Daily credit budget per provider (0 = uncapped). Set PROVIDER_BUDGET_<ID> to change a limit, e.g. PROVIDER_BUDGET_SPORTMONKS=5000, or 0 to remove a default cap. ODDS_DAILY_CREDIT_BUDGET is still honoured for odds. */
const DEFAULTS: Partial<Record<ProviderId, number>> = { "odds-api": 16, serpapi: 3, newsapi: 90 };
export function budgetFor(provider: ProviderId, env: Record<string, string | undefined> = process.env): number {
  const key = `PROVIDER_BUDGET_${provider.toUpperCase().replace(/-/g, "_")}`;
  const raw = env[key] ?? (provider === "odds-api" ? env.ODDS_DAILY_CREDIT_BUDGET : undefined);
  const n = raw == null || raw === "" ? DEFAULTS[provider] ?? 0 : Number(raw);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
}
