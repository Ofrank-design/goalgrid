import "server-only";
import { cached } from "@/lib/cache";
import { log } from "@/lib/logging/logger";
import { getFixtures } from "@/lib/engine/ingestion/fixtures";
import { getHistory } from "@/lib/engine/ingestion/history";
import { getMarketSignal, getWeatherSignal } from "@/lib/engine/ingestion/context";
import { getMatchSignals } from "@/lib/engine/ingestion/signals";
import { analysisOf } from "@/lib/engine/analysis";
import { teamFormOf, headToHeadOf, streakOf, venueOf } from "@/lib/engine/models/context-stats";
import { baselinePrediction, buildEnsemble, historyTeam, predictMatch, weightedMatrix, type Ensemble } from "@/lib/engine/models/ensemble";
import type { Match, LeagueSlug } from "@/types/football";
import type { ModelMetric, PredictCtx, Prediction } from "@/types/prediction";
import { fitStrengths, lambdas } from "@/lib/engine/models/strengths";
import { summarize } from "@/lib/engine/scenarios";
import { buildRegistry, type RegistryEntry } from "@/lib/engine/registry";
import { background } from "@/lib/server/background";
import { readLeagueCache, readStoredPredictions, writeLeagueCache, writeStoredPredictions } from "./store";
/** `frozen` is true when the prediction was stored before kickoff, so it can be scored against the result. Anything computed after the fact is shown but never scored. */
export interface PredictedMatch { match: Match; prediction: Prediction | null; reason?: string; frozen?: boolean }
export interface PredictionsResult { date: string; source: string | null; stale: boolean; items: PredictedMatch[]; leagues: Record<string, { historyMatches: number; metrics: ModelMetric[] }> }
/**
 * One fixture, never skipped. The fixture's team names are first matched to the names in the history (providers spell clubs differently).
 * If the models can price it, that is the prediction; if a club has no history, or too few models can price it, the result is a flagged
 * baseline estimate (league averages, tilted to bookmaker odds when we have them), logged so the cause can be audited.
 */
const withAnalysis = (match: Match, p: Prediction): Prediction => { try { return { ...p, analysis: analysisOf(match, p) }; } catch (err) { log.warn("analysis failed", { match: match.id, message: (err as Error).message }); return p; } };
function forecast(e: Ensemble, match: Match, ctx: PredictCtx): Prediction {
  const home = historyTeam(e, match.home.name, match.home.slug), away = historyTeam(e, match.away.name, match.away.slug);
  // Look up both teams' recent results and their past meetings first; they travel with the prediction for the card and the AI analysis.
  const context = home && away && e.history ? { homeForm: teamFormOf(e.history, home), awayForm: teamFormOf(e.history, away), homeStreak: streakOf(e.history, home), awayStreak: streakOf(e.history, away), homeAtHome: venueOf(e.history, home, "home"), awayAway: venueOf(e.history, away, "away"), h2h: headToHeadOf(e.history, home, away) } : undefined;
  try { const p = home && away && home !== away ? predictMatch(e, home, away, ctx) : null; if (p) return withAnalysis(match, { ...p, ...(context ? { context } : {}) }); }
  catch (err) { log.warn("prediction failed", { match: match.id, message: (err as Error).message }); }
  const unknown = [!home && match.home.name, !away && match.away.name].filter(Boolean).join(" and ");
  log.warn("baseline estimate", { match: match.id, league: match.league.slug, unknown: unknown || "too few models could price it" });
  const base = baselinePrediction(e, ctx, unknown ? `No match history found for ${unknown}, so this uses league averages${ctx.market ? " and bookmaker odds" : ""}.` : "Too few models could price this fixture, so this uses league averages.");
  return withAnalysis(match, context ? { ...base, context } : base);
}
const ensembleFor = (l: LeagueSlug) => cached(`ensemble:${l}`, 12 * 3_600_000, 48 * 3_600_000, async () => buildEnsemble(await getHistory(l))).then(r => r.value);
/**
 * Predictions for one date. Requests read what the refresh cron already computed and stored (engine_cache), so a visitor never waits for models to fit.
 * Matches with no usable stored prediction (a date the cron does not cover, a missed run) are fitted on demand, as before.
 * refresh: true is the cron path: it ignores stored rows, refits everything and writes the results back.
 */
export async function getPredictions(date: string, opts: { refresh?: boolean } = {}): Promise<PredictionsResult> {
  const fx = await getFixtures(date);
  const stored = opts.refresh ? new Map<string, Prediction>() : await readStoredPredictions(fx.matches);
  const missing = fx.matches.filter(m => !stored.has(m.id)), slugs = [...new Set(missing.map(m => m.league.slug))];
  const ens = new Map(await Promise.all(slugs.map(async l => { try { return [l, await ensembleFor(l)] as const; } catch (e) { log.warn("ensemble unavailable", { league: l, message: (e as Error).message }); return [l, null] as const; } })));
  const items = await Promise.all(fx.matches.map(async (match): Promise<PredictedMatch> => {
    const hit = stored.get(match.id); if (hit) return { match, prediction: hit, frozen: true };
    const e = ens.get(match.league.slug); if (!e) return { match, prediction: null, reason: "No match history available for this league yet" };
    let market = null; if (match.status === "scheduled" || match.status === "live") { try { const s = await getMarketSignal(match); market = s ? s.impliedProbabilities : null; } catch { /* market is optional */ } }
    return { match, prediction: forecast(e, match, { market, kickoffUtc: match.kickoffUtc }) };
  }));
  const leagues: PredictionsResult["leagues"] = {};
  for (const [l, e] of ens) if (e) leagues[l] = { historyMatches: e.historyMatches, metrics: e.metrics };
  // Leagues served entirely from stored predictions still need their metrics for the page.
  const metricsOnly = [...new Set(fx.matches.map(m => m.league.slug))].filter(l => !leagues[l]);
  await Promise.all(metricsOnly.map(async l => { const m = await readLeagueCache<PredictionsResult["leagues"][string]>(l, "metrics", 48 * 3_600_000); if (m) leagues[l] = m; }));
  // Write back what was just computed so other server instances and later requests do not refit.
  const fresh = items.flatMap(i => i.prediction && !i.prediction.baseline && !stored.has(i.match.id) ? [{ match: i.match, prediction: i.prediction }] : []);
  const persist = () => Promise.all([
    writeStoredPredictions(fresh),
    ...(opts.refresh ? [...ens].flatMap(([l, e]) => e ? [writeLeagueCache(l, "metrics", leagues[l]), writeLeagueCache(l, "models", leagueModelsOf(l as LeagueSlug, e))] : []) : []),
  ]);
  if (opts.refresh) await persist(); else background(persist);
  return { date, source: fx.source, stale: fx.stale, items, leagues };
}

/** One match, every model, with every piece of context we have: market odds, the weather at kickoff and the kickoff time itself. */
export async function predictOne(date: string, matchId: string): Promise<(PredictedMatch & { leagueMetrics: ModelMetric[] }) | null> {
  const fx = await getFixtures(date), match = fx.matches.find(m => m.id === matchId); if (!match) return null;
  let e; try { e = await ensembleFor(match.league.slug); } catch { return { match, prediction: null, reason: "No match history available for this league yet", leagueMetrics: [] }; }
  const open = match.status === "scheduled" || match.status === "live"; let market = null, weather = null;
  if (open) { try { const s = await getMarketSignal(match); market = s ? s.impliedProbabilities : null; } catch { /* optional */ } try { const w = await getWeatherSignal(match); weather = w ? { tempC: w.tempC, windKmh: w.windKmh, rainChancePct: w.rainChancePct } : null; } catch { /* optional */ } }
  let signals; if (open) { try { const s = await getMatchSignals(match); if (s.availabilityShift != null) signals = { availabilityShift: s.availabilityShift }; } catch { /* optional */ } }
  return { match, prediction: forecast(e, match, { market, weather, kickoffUtc: match.kickoffUtc, signals }), leagueMetrics: e.metrics };
}

/** The model library for one league: registry entries plus the meta component fits. Pro and Premium only (checked in the route). */
export type LeagueModels = { league: LeagueSlug; builtAt: string; historyMatches: number; baselineLogLoss: number | null; registry: RegistryEntry[]; stack: unknown; conformal: unknown };
const leagueModelsOf = (league: LeagueSlug, e: Awaited<ReturnType<typeof ensembleFor>>): LeagueModels => ({ league, builtAt: e.builtAt, historyMatches: e.historyMatches, baselineLogLoss: e.baselineLogLoss, registry: buildRegistry(e), stack: e.stack, conformal: e.conformal });
export async function getLeagueModels(league: LeagueSlug): Promise<LeagueModels> {
  const stored = await readLeagueCache<LeagueModels>(league, "models", 13 * 3_600_000); if (stored) return stored;
  const out = leagueModelsOf(league, await ensembleFor(league)); background(() => writeLeagueCache(league, "models", out)); return out;
}

/** Baseline matrix for one real fixture, used by the Scenario Lab. */
export async function scenarioBase(date: string, matchId: string): Promise<{ match: Match; matrix: number[][] | null } | null> {
  const fx = await getFixtures(date), match = fx.matches.find(m => m.id === matchId); if (!match) return null;
  let e; try { e = await ensembleFor(match.league.slug); } catch { return { match, matrix: null }; }
  return { match, matrix: weightedMatrix(e, match.home.slug, match.away.slug, { kickoffUtc: match.kickoffUtc }) };
}

/** Teams that played in this league within the last year, sorted. Only these can be simulated. */
export async function leagueTeams(league: LeagueSlug): Promise<string[]> {
  const h = await getHistory(league), since = Date.now() - 400 * 86_400_000, t = new Set<string>(); for (const m of h) if (Date.parse(m.date) >= since) { t.add(m.home); t.add(m.away); } return [...t].sort();
}
/** Baseline score matrix and expected goals for any two teams in a league, from the same weighted models as the real predictions. */
export async function matchupBase(league: LeagueSlug, home: string, away: string): Promise<{ matrix: number[][]; xg: { home: number; away: number } } | null> {
  const e = await ensembleFor(league), m = weightedMatrix(e, home, away, {}); if (!m) return null; const s = summarize(m); return { matrix: m, xg: { home: s.xgHome, away: s.xgAway } };
}
/** Strength model rates for season simulation. */
export async function seasonInputs(league: LeagueSlug): Promise<{ teams: string[]; rates: (h: string, a: string) => { lh: number; la: number } | null } | null> {
  const [h, teams] = await Promise.all([getHistory(league), leagueTeams(league)]), s = fitStrengths(h, new Date(), 300); if (!s || teams.length < 4) return null;
  return { teams, rates: (a, b) => { const l = lambdas(s, a, b); return l ? { lh: Math.min(Math.max(l.lh, 0.15), 4.5), la: Math.min(Math.max(l.la, 0.15), 4.5) } : null; } };
}

/** Every model's own view of a matchup, for the Simulation Lab's model comparison. Same fitted models and weights as the real prediction, never changed by the lab. */
export async function modelOutputs(league: LeagueSlug, home: string, away: string) {
  const e = await ensembleFor(league), rows = e.fitted.flatMap(x => { let o; try { o = x.fitted.predict(home, away, {}); } catch { o = null; } if (!o) return []; let btts: number | null = null, over: number | null = null;
    if (o.matrix) { btts = 0; over = 0; o.matrix.forEach((r, i) => r.forEach((v, j) => { if (i > 0 && j > 0) btts! += v; if (i + j > 2) over! += v; })); }
    const q = x.calibrate ? x.calibrate([o.home, o.draw, o.away]) : [o.home, o.draw, o.away]; return [{ id: x.model.id, name: x.model.name, family: x.model.family, weight: x.weight, home: q[0], draw: q[1], away: q[2], btts, over25: over, xgHome: o.lambdaHome ?? null, xgAway: o.lambdaAway ?? null }]; });
  return { rows, abstained: e.waiting.length };
}
