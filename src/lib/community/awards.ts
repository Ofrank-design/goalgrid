import "server-only";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { log } from "@/lib/logging/logger";
import { earned, type TrophyBasis } from "./trophies";
import { recordOf, type SettledPick } from "./userstats";
/** Checks a user's real record against the trophy rules and awards what is new. Idempotent: the primary key stops a second award. Booking shares are never read here. */
export async function awardFor(userId: string): Promise<string[]> {
  const db = supabaseAdmin();
  try {
    const [{ count: submitted }, { data: settled }, { count: exact }, { count: posts }, { data: mine }, { data: have }, { data: board }] = await Promise.all([
      db.from("user_predictions").select("match_id", { count: "exact", head: true }).eq("user_id", userId), db.from("user_predictions").select("pick,outcome,points,settled_at").eq("user_id", userId).not("settled_at", "is", null), db.from("user_market_picks").select("match_id", { count: "exact", head: true }).eq("user_id", userId).eq("market", "exact").eq("correct", true),
      db.from("posts").select("id", { count: "exact", head: true }).eq("user_id", userId).eq("status", "visible"), db.from("posts").select("id").eq("user_id", userId).eq("status", "visible").limit(500),
      db.from("user_trophies").select("code").eq("user_id", userId), db.from("leaderboard_all").select("username,points").order("points", { ascending: false }).limit(10)]);
    const ids = (mine ?? []).map(p => p.id as string); let likes = 0; if (ids.length) { const { count } = await db.from("post_likes").select("post_id", { count: "exact", head: true }).in("post_id", ids).neq("user_id", userId); likes = count ?? 0; }
    const { data: me } = await db.from("profiles").select("username").eq("id", userId).maybeSingle();
    const record = recordOf((settled ?? []).map(r => ({ pick: r.pick, outcome: r.outcome, points: r.points, settledAt: r.settled_at }) as SettledPick));
    const basis: TrophyBasis = { submitted: submitted ?? 0, record, exactHits: exact ?? 0, activePosts: posts ?? 0, likesOnPosts: likes, topTen: !!me?.username && record.evaluated >= 10 && (board ?? []).some(b => b.username === me.username) };
    const fresh = earned(basis, (have ?? []).map(h => h.code as string));
    for (const code of fresh) { const { error } = await db.from("user_trophies").insert({ user_id: userId, code }); if (!error) await db.from("trophy_award_audits").insert({ user_id: userId, code, basis: { evaluated: record.evaluated, accuracy: record.accuracy, longestStreak: record.longestStreak, submitted: basis.submitted, activePosts: basis.activePosts, likes } }); }
    return fresh;
  } catch (e) { log.error("trophy award failed", { message: (e as Error).message }); return []; }
}
