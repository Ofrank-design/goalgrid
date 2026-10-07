import type { NewsArticle } from "../../../types/context";
export interface SerpResponse { news_results?: { title: string; link: string; source?: { name?: string } | string; date?: string; snippet?: string }[] }
const hash = (s: string) => { let h = 5381; for (const c of s) h = ((h << 5) + h + c.charCodeAt(0)) | 0; return (h >>> 0).toString(36); };
export function normalizeSerp(r: SerpResponse): NewsArticle[] {
  return (r.news_results ?? []).filter(a => a.title && a.link).map(a => {
    const t = a.date ? Date.parse(a.date) : NaN;
    return { id: `sa:${hash(a.link)}`, title: a.title, source: typeof a.source === "string" ? a.source : a.source?.name ?? "Unknown", url: a.link, publishedAt: Number.isNaN(t) ? null : new Date(t).toISOString(), snippet: a.snippet ? a.snippet.slice(0, 200) : null };
  });
}
/** Same story from two providers collapses to one article. */
export function dedupeNews(a: NewsArticle[]): NewsArticle[] {
  const seen = new Set<string>(); return a.filter(x => { const k = x.title.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim(); if (seen.has(k)) return false; seen.add(k); return true; });
}
