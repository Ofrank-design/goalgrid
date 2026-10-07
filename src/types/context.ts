import type { Source } from "./football";
export type ContextSource = Source | "odds-api" | "open-meteo" | "openweather" | "newsapi" | "serpapi";
export interface CtxProvenance { source: ContextSource; retrievedAt: string; expiresAt: string }
export interface OddsEvent { id: string; sport_key: string; commence_time: string; home_team: string; away_team: string;
  bookmakers: { key: string; title: string; last_update: string; markets: { key: string; outcomes: { name: string; price: number; point?: number }[] }[] }[] }
export interface Triple { home: number; draw: number; away: number }
/** Market signal: bookmaker odds with the margin removed, averaged across bookmakers. Context for the models, not a prediction. */
export interface MarketSnapshot { bookmakers: number; impliedProbabilities: Triple; bestOdds: Triple; averageOverround: number; goals25: { over: number; under: number } | null; provenance: CtxProvenance }
export interface Weather { tempC: number; humidityPct: number; windKmh: number; rainChancePct: number | null; forecastForUtc: string; provenance: CtxProvenance }
export interface NewsArticle { id: string; title: string; source: string; url: string; publishedAt: string | null; snippet: string | null }
export interface MatchContext { market: MarketSnapshot | null; weather: Weather | null; news: NewsArticle[]; notes: string[]; provenance: { generatedAt: string } }
