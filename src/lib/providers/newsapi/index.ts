import "server-only";
import { env } from "@/lib/env";
import { providerFetch } from "../http";
import { spendCredits } from "../budget";
import { ProviderError, type ProviderAdapter } from "../types";
import type { NewsArticle } from "@/types/context";
import { normalizeNewsApi, type TnResponse } from "./normalize";
export const newsApi: ProviderAdapter<NewsArticle[], { home: string; away: string; sinceIso: string }> & { configured(): boolean } = {
  id: "newsapi",
  configured: () => Boolean(env().NEWS_API_KEY),
  async fetch({ home, away, sinceIso }) {
    const key = env().NEWS_API_KEY; if (!key) throw new ProviderError("newsapi", "auth", "Not configured");
    await spendCredits("newsapi");
    const q = encodeURIComponent(`"${home}" | "${away}"`);
    const url = `https://api.thenewsapi.com/v1/news/all?api_token=${encodeURIComponent(key)}&search=${q}&language=en&categories=sports&published_after=${sinceIso.slice(0, 19)}&limit=5`;
    const { json, latencyMs } = await providerFetch<TnResponse>({ provider: "newsapi", url });
    return { data: normalizeNewsApi(json), meta: { provider: "newsapi", fetchedAt: new Date().toISOString(), cached: false, latencyMs } };
  },
  async health() { return { ok: this.configured() }; },
};
