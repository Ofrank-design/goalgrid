import "server-only";
import { cached } from "@/lib/cache";
import { log } from "@/lib/logging/logger";
import { recordHealth } from "@/lib/providers/health";
import { oddsApi } from "@/lib/providers/odds-api";
import { oddsPapi } from "@/lib/providers/oddspapi";
import { fetchTsOdds, theStatsApi } from "@/lib/providers/thestatsapi";
import { openMeteo } from "@/lib/providers/open-meteo";
import { openWeather } from "@/lib/providers/openweather";
import { newsApi } from "@/lib/providers/newsapi";
import { serpApi } from "@/lib/providers/serpapi";
import { dedupeNews } from "@/lib/providers/serpapi/normalize";
import { buildMarket, findOddsEvent } from "@/lib/engine/normalization/odds";
import type { Match } from "@/types/football";
import type { MarketSnapshot, MatchContext, NewsArticle, OddsEvent, Weather } from "@/types/context";
const H = 3_600_000;
/** Bookmaker prices from every configured provider are merged by bookmaker, so a second source adds coverage instead of replacing the first. */
async function market(m: Match, notes: string[]): Promise<MarketSnapshot | null> {
  const sources = [oddsApi, oddsPapi].filter(p => p.configured()); if (!sources.length && !theStatsApi.configured()) { notes.push("Odds: no provider configured"); return null; }
  const ttl = Number(process.env.ODDS_CACHE_HOURS ?? 6) * H, found: OddsEvent[] = [];
  const results = await Promise.allSettled(sources.map(async p => { const { value } = await cached(`odds:${p.id}:${m.league.slug}`, ttl, 24 * H, async () => { const r = await p.fetch({ league: m.league.slug }); void recordHealth(p.id, true, r.meta.latencyMs); return r.data; }); const ev = findOddsEvent(value, m); if (ev) found.push(ev); }));
  results.forEach((r, i) => { if (r.status === "rejected") void recordHealth(sources[i].id, false); });
  // TheStatsAPI prices one match per request, so it is asked only when the per-league odds feeds found nothing.
  let viaTs = false;
  if (!found.length && theStatsApi.configured()) { try { const ev = await fetchTsOdds(m); if (ev) { found.push(ev); viaTs = true; } } catch { void recordHealth("thestatsapi", false); } }
  if (!found.length) { notes.push("Odds: no bookmaker listing matched this fixture"); return null; }
  const seen = new Set<string>(), merged: OddsEvent = { ...found[0], bookmakers: found.flatMap(e => e.bookmakers).filter(b => !seen.has(b.key) && seen.add(b.key)) };
  const snap = buildMarket(merged); return snap && viaTs ? { ...snap, provenance: { ...snap.provenance, source: "thestatsapi" } } : snap;
}
/** Odds only, for the prediction engine. Shares the per league odds cache, so it adds no extra credits. */
export async function getMarketSignal(m: Match): Promise<MarketSnapshot | null> { return market(m, []); }
export async function getWeatherSignal(m: Match): Promise<Weather | null> { return weather(m, []); }
async function weather(m: Match, notes: string[]): Promise<Weather | null> {
  const v = m.venue; if (!v || v.lat == null || v.lon == null) { notes.push("Weather: no venue coordinates for this fixture"); return null; }
  const k = Date.parse(m.kickoffUtc), now = Date.now();
  if (m.status === "finished" || k < now - 3 * H || k > now + 15 * 24 * H) { notes.push("Weather: kickoff is outside the forecast window"); return null; }
  const key = `wx:${v.lat.toFixed(2)},${v.lon.toFixed(2)}:${m.kickoffUtc.slice(0, 13)}`, args = { lat: v.lat, lon: v.lon, kickoffUtc: m.kickoffUtc };
  const { value } = await cached(key, H, 6 * H, async () => {
    try { const r = await openMeteo.fetch(args); void recordHealth("open-meteo", true, r.meta.latencyMs); if (r.data) return r.data; } catch { void recordHealth("open-meteo", false); }
    if (openWeather.configured()) { const r = await openWeather.fetch(args); void recordHealth("openweather", true, r.meta.latencyMs); return r.data; }
    return null;
  });
  if (!value) notes.push("Weather: forecast unavailable for kickoff time"); return value;
}
async function news(m: Match, notes: string[]): Promise<NewsArticle[]> {
  const { value } = await cached(`news:${m.home.slug}:${m.away.slug}:${new Date().toISOString().slice(0, 10)}`, 30 * 60_000, 6 * H, async () => {
    const out: NewsArticle[] = [], since = new Date(Date.now() - 3 * 24 * H).toISOString();
    if (newsApi.configured()) try { out.push(...(await newsApi.fetch({ home: m.home.name, away: m.away.name, sinceIso: since })).data); } catch { void recordHealth("newsapi", false); }
    if (out.length < 3 && serpApi.configured()) try { out.push(...(await serpApi.fetch({ home: m.home.name, away: m.away.name })).data); } catch { void recordHealth("serpapi", false); }
    return dedupeNews(out).slice(0, 6);
  });
  if (!value.length) notes.push("News: no recent articles found"); return value;
}
/** Each signal settles on its own, so one failing provider never blocks the others. */
export async function getMatchContext(m: Match): Promise<MatchContext> {
  const notes: string[] = [], [mk, wx, nw] = await Promise.allSettled([market(m, notes), weather(m, notes), news(m, notes)]);
  const pick = <T,>(r: PromiseSettledResult<T>, name: string, fb: T): T => { if (r.status === "fulfilled") return r.value; log.warn("context signal failed", { signal: name, message: (r.reason as Error)?.message }); notes.push(`${name}: temporarily unavailable`); return fb; };
  return { market: pick(mk, "Odds", null), weather: pick(wx, "Weather", null), news: pick(nw, "News", []), notes, provenance: { generatedAt: new Date().toISOString() } };
}
