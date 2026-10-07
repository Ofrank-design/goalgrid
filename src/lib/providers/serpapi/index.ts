import "server-only";
import { env } from "@/lib/env";
import { providerFetch } from "../http";
import { spendCredits } from "../budget";
import { ProviderError, type ProviderAdapter } from "../types";
import type { NewsArticle } from "@/types/context";
import { normalizeSerp, type SerpResponse } from "./normalize";
export const serpApi: ProviderAdapter<NewsArticle[], { home: string; away: string }> & { configured(): boolean } = {
  id: "serpapi",
  configured: () => Boolean(env().SERPAPI_API_KEY),
  async fetch({ home, away }) {
    const key = env().SERPAPI_API_KEY; if (!key) throw new ProviderError("serpapi", "auth", "Not configured");
    await spendCredits("serpapi");
    const url = `https://serpapi.com/search.json?engine=google_news&q=${encodeURIComponent(`${home} ${away}`)}&hl=en&api_key=${encodeURIComponent(key)}`;
    const { json, latencyMs } = await providerFetch<SerpResponse>({ provider: "serpapi", url });
    return { data: normalizeSerp(json).slice(0, 5), meta: { provider: "serpapi", fetchedAt: new Date().toISOString(), cached: false, latencyMs } };
  },
  async health() { return { ok: this.configured() }; },
};
