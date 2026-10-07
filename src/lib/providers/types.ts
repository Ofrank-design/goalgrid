/** Provider adapter rule: raw provider data is converted into GoalGrid types in adapters, and nowhere else. */
export type ProviderId = "sportmonks" | "football-data" | "api-football" | "stats" | "oddspapi" | "odds-api" | "openweather" | "open-meteo" | "serpapi" | "newsapi" | "resend" | "groq" | "anthropic" | "openrouter" | "gemini" | "nvidia";
export interface ProviderMeta { fetchedAt: string; provider: ProviderId; cached: boolean; latencyMs: number }
export interface ProviderResult<T> { data: T; meta: ProviderMeta }
export class ProviderError extends Error {
  constructor(public provider: ProviderId, public kind: "timeout" | "rate_limited" | "auth" | "bad_response" | "network" | "circuit_open", message: string, public status?: number) { super(message); }
}
export interface ProviderAdapter<TNormalized, TQuery = void> {
  readonly id: ProviderId;
  fetch(query: TQuery, signal?: AbortSignal): Promise<ProviderResult<TNormalized>>;
  health(): Promise<{ ok: boolean; detail?: string }>;
}
