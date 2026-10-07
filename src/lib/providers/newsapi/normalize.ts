import type { NewsArticle } from "../../../types/context";
export interface TnResponse { data?: { uuid: string; title: string; description?: string | null; url: string; published_at?: string | null; source?: string | null }[] }
const clip = (s?: string | null) => (s ? (s.length > 200 ? s.slice(0, 197) + "..." : s) : null);
export function normalizeNewsApi(r: TnResponse): NewsArticle[] {
  return (r.data ?? []).filter(a => a.title && a.url).map(a => ({ id: `tn:${a.uuid}`, title: a.title, source: a.source ?? "Unknown", url: a.url, publishedAt: a.published_at ?? null, snippet: clip(a.description) }));
}
