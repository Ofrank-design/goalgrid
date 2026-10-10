import "server-only";
import { cached } from "@/lib/cache";
import { log } from "@/lib/logging/logger";
import { observedBefore } from "@/lib/providers/resolve";
import { fetchBigBallsContext, bigBalls } from "@/lib/providers/big-balls";
import { fetchTsLineupsConfirmed, fetchTsUnavailable, findTsMatch, theStatsApi } from "@/lib/providers/thestatsapi";
import { availabilityShiftFrom, eloGap } from "./signals-core";
import type { Match } from "@/types/football";
import type { MatchSignals, ModelNote } from "@/types/signals";

const empty = (m: Match, predictionTime: string, notes: string[], degraded: ModelNote[] = []): MatchSignals => ({ matchId: m.id, predictionTime, availability: null, availabilityShift: null, lineupsConfirmed: null, ratings: null, degraded, notes });

/**
 * Pre-match signals from the newer providers. Each part settles on its own: a part that is missing becomes a note and a degraded
 * model, never an error. Nothing is built for a match that has kicked off, and every value must have been observed at or before the
 * freeze time (kickoff, or now if earlier), so a post-kickoff value can never reach a prediction.
 */
export async function getMatchSignals(m: Match, now = new Date()): Promise<MatchSignals> {
  const kick = Date.parse(m.kickoffUtc), predictionTime = new Date(Math.min(now.getTime(), Number.isFinite(kick) ? kick : now.getTime())).toISOString();
  if (m.status !== "scheduled" || (Number.isFinite(kick) && kick <= now.getTime())) return empty(m, predictionTime, ["Signals are only built before kickoff"]);
  return (await cached(`signals:${m.id}`, 10 * 60_000, 60 * 60_000, () => build(m, predictionTime))).value;
}

async function build(m: Match, predictionTime: string): Promise<MatchSignals> {
  const notes: string[] = [], degraded: ModelNote[] = [], out = empty(m, predictionTime, notes, degraded), seen = new Date().toISOString();
  const keep = (what: string, observedAt: string) => { if (observedBefore(observedAt, predictionTime)) return true; notes.push(`${what}: dropped, observed after the prediction time`); return false; };

  const [avail, rating] = await Promise.allSettled([
    (async () => {
      if (!theStatsApi.configured()) throw new Error("TheStatsAPI is not configured");
      const ts = await findTsMatch(m); if (!ts) throw new Error("fixture not found on TheStatsAPI");
      const [home, away, confirmed] = await Promise.all([fetchTsUnavailable(ts.home.providerId), fetchTsUnavailable(ts.away.providerId), fetchTsLineupsConfirmed(ts.id).catch(() => null)]);
      return { home, away, confirmed };
    })(),
    (async () => { if (!bigBalls.configured()) throw new Error("Big Balls is not configured"); return fetchBigBallsContext(m); })(),
  ]);

  if (avail.status === "fulfilled" && avail.value.home && avail.value.away && keep("Availability", seen)) {
    out.availability = { home: avail.value.home, away: avail.value.away }; out.availabilityShift = availabilityShiftFrom(avail.value.home, avail.value.away); out.lineupsConfirmed = avail.value.confirmed;
  } else { const why = avail.status === "rejected" ? (avail.reason as Error).message : "no injury or suspension data for one of the teams"; degraded.push({ model: "player-availability", health: "unavailable", reason: why }); notes.push(`Availability: ${why}`); if (avail.status === "rejected") log.warn("availability signal failed", { match: m.id, message: why }); }

  degraded.push({ model: "lineup-strength", health: "unavailable", reason: "No player-rating feed: lineups carry players but no ratings" });

  if (rating.status === "fulfilled" && rating.value && (rating.value.home || rating.value.away) && keep("Ratings", seen)) {
    out.ratings = { home: rating.value.home, away: rating.value.away, eloGap: eloGap(rating.value.home, rating.value.away) };
  } else { const why = rating.status === "rejected" ? (rating.reason as Error).message : "fixture or ratings not available on Big Balls"; notes.push(`Ratings: ${why}`); }
  return out;
}
