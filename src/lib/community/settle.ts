import "server-only";
import { cached } from "@/lib/cache";
import { log } from "@/lib/logging/logger";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { getFixtures } from "@/lib/engine/ingestion/fixtures";
import { awardFor } from "./awards";
import { scoreMarket, type Market } from "./markets";
import { outcomeOf, pickPoints, type Pick } from "./scoring";
import { challengeCompletions, groupBy, type PickRow } from "./settle-logic";
import { createNotification } from "@/lib/notifications/server";
/** Notifies entrants whose every pick is settled and closes ended challenges. A fixed handful of queries however many challenges and entrants there are. */
async function settleChallengeNotifications(userIds: Set<string>) {
  if (!userIds.size) return;
  const db = supabaseAdmin(), now = new Date().toISOString();
  const { data: challenges } = await db.from("challenges").select("id,title,ends_at").lt("ends_at", now).limit(20);
  if (!challenges?.length) return;
  const refs = challenges.map(c => ({ id: c.id as string, title: c.title as string })), cids = refs.map(c => c.id), users = [...userIds];
  const [{ data: cms }, { data: ents }] = await Promise.all([
    db.from("challenge_matches").select("challenge_id,match_id").in("challenge_id", cids),
    db.from("challenge_entries").select("challenge_id,user_id").in("challenge_id", cids).in("user_id", users),
  ]);
  const matchesBy = groupBy(cms ?? [], r => r.challenge_id as string, r => r.match_id as string), entriesBy = groupBy(ents ?? [], r => r.challenge_id as string, r => r.user_id as string);
  const matchIds = [...new Set((cms ?? []).map(r => r.match_id as string))], entrants = [...new Set((ents ?? []).map(r => r.user_id as string))], picks: PickRow[] = [];
  // 50 entrants x ~10 matches stays well under the API's 1000 row page.
  for (let i = 0; matchIds.length && i < entrants.length; i += 50) {
    const { data } = await db.from("user_predictions").select("user_id,match_id,settled_at,points").in("user_id", entrants.slice(i, i + 50)).in("match_id", matchIds);
    picks.push(...((data ?? []) as PickRow[]));
  }
  for (const d of challengeCompletions(refs, matchesBy, entriesBy, picks))
    await createNotification({ userId: d.userId, type: "challenge", title: "Challenge complete", body: `${d.title} is complete. Your recorded challenge points: ${d.points}.`, href: `/challenges/${d.challengeId}`, dedupeKey: `challenge:complete:${d.challengeId}:${d.userId}` });
  await db.from("challenges").update({ status: "closed" }).in("id", cids).neq("status", "closed");
}

/** Scores predictions whose matches have finished. Postponed or long overdue matches are voided. Safe to run repeatedly. */
/** Scores BTTS, over/under and exact score picks from the final score. Postponed or long overdue matches are voided with no points. */
async function settleMarkets(): Promise<Set<string>> {
  const db = supabaseAdmin(), cutoff = new Date(Date.now() - 2 * 3_600_000).toISOString(), users = new Set<string>();
  const { data } = await db.from("user_market_picks").select("user_id,match_id,match_date,market,value,kickoff_utc").is("settled_at", null).lt("kickoff_utc", cutoff).limit(1000);
  const rows = (data ?? []) as { user_id: string; match_id: string; match_date: string; market: Market; value: string; kickoff_utc: string }[]; if (!rows.length) return users;
  const fixtures = new Map<string, Awaited<ReturnType<typeof getFixtures>> | null>(); for (const d of new Set(rows.map(r => r.match_date))) { try { fixtures.set(d, await getFixtures(d)); } catch { fixtures.set(d, null); } }
  for (const r of rows) {
    const m = fixtures.get(r.match_date)?.matches.find(x => x.id === r.match_id), overdue = Date.now() - Date.parse(r.kickoff_utc) > 4 * 86_400_000; let patch: { points: number; correct: boolean | null } | null = null;
    if (m?.status === "finished" && m.score.home != null && m.score.away != null) patch = scoreMarket(r.market, r.value, m.score.home, m.score.away); else if (m?.status === "postponed" || m?.status === "cancelled" || overdue) patch = { points: 0, correct: null };
    if (!patch) continue; const { error } = await db.from("user_market_picks").update({ ...patch, settled_at: new Date().toISOString() }).eq("user_id", r.user_id).eq("match_id", r.match_id).eq("market", r.market).is("settled_at", null); if (!error) users.add(r.user_id);
  }
  return users;
}
export async function settleDue(): Promise<number> {
  const db = supabaseAdmin(), cutoff = new Date(Date.now() - 2 * 3_600_000).toISOString();
  const { data } = await db.from("user_predictions").select("user_id,match_id,match_date,pick,confidence,kickoff_utc").is("settled_at", null).lt("kickoff_utc", cutoff).limit(500);
  const rows = (data ?? []) as { user_id: string; match_id: string; match_date: string; pick: string; confidence: number; kickoff_utc: string }[]; if (!rows.length) return 0;
  const fixtures = new Map<string, Awaited<ReturnType<typeof getFixtures>> | null>();
  for (const d of new Set(rows.map(r => r.match_date))) { try { fixtures.set(d, await getFixtures(d)); } catch { fixtures.set(d, null); } }
  let n = 0; const touched = new Set<string>();
  for (const r of rows) {
    const m = fixtures.get(r.match_date)?.matches.find(x => x.id === r.match_id), overdue = Date.now() - Date.parse(r.kickoff_utc) > 4 * 86_400_000;
    let patch: { outcome: string; points: number } | null = null;
    if (m?.status === "finished" && m.score.home != null && m.score.away != null) { const o = outcomeOf(m.score.home, m.score.away); patch = { outcome: o, points: pickPoints(r.pick as Pick, r.confidence, o) }; }
    else if (m?.status === "postponed" || m?.status === "cancelled" || overdue) patch = { outcome: "void", points: 0 };
    if (!patch) continue;
    const { error } = await db.from("user_predictions").update({ ...patch, settled_at: new Date().toISOString() }).eq("user_id", r.user_id).eq("match_id", r.match_id).is("settled_at", null);
    if (error) log.error("settle failed", { matchId: r.match_id }); else { n++; touched.add(r.user_id); }
  }
  try { for (const u of await settleMarkets()) touched.add(u); } catch (e) { log.error("market settle failed", { message: (e as Error).message }); }
  for (const u of touched) await awardFor(u);
  try { await settleChallengeNotifications(touched); } catch (e) { log.warn("challenge notification settle failed", { message: (e as Error).message }); }
  return n;
}
/** Lazy trigger for pages: at most once every 10 minutes per server instance. */
export const settleSoon = () => cached("settle", 10 * 60_000, 0, settleDue).then(r => r.value).catch(() => 0);
