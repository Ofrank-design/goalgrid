import "server-only";
import { supabaseAdmin } from "@/lib/supabase/admin";
export interface BookingCard { id: string; bookingCode: string; bookmaker: string | null; matchId: string | null; odds: number | null; note: string | null; hasProof: boolean; verification: string; createdAt: string; username: string; likes: number; comments: number }
/** Users the viewer has blocked, been blocked by, or muted. Blocks work both ways so neither side sees the other. */
export async function hiddenAuthors(viewerId: string | null): Promise<Set<string>> {
  const out = new Set<string>(); if (!viewerId) return out; const db = supabaseAdmin();
  const [a, b, c] = await Promise.all([db.from("blocks").select("blocked_id").eq("blocker_id", viewerId), db.from("blocks").select("blocker_id").eq("blocked_id", viewerId), db.from("mutes").select("muted_id").eq("muter_id", viewerId)]);
  (a.data ?? []).forEach(r => out.add(r.blocked_id as string)); (b.data ?? []).forEach(r => out.add(r.blocker_id as string)); (c.data ?? []).forEach(r => out.add(r.muted_id as string)); return out;
}
/** Public shares, plus follower-only shares from people the viewer follows. Hidden, removed and banned content is never returned. */
export async function bookingFeed(viewerId: string | null, opts: { username?: string; limit?: number } = {}): Promise<BookingCard[]> {
  const db = supabaseAdmin(), hide = await hiddenAuthors(viewerId);
  const follows = new Set<string>(); if (viewerId) (await db.from("follows").select("followee_id").eq("follower_id", viewerId)).data?.forEach(r => follows.add(r.followee_id as string));
  let q = db.from("community_booking_posts").select("id,user_id,booking_code,bookmaker,match_id,odds,note,proof_path,verification_status,visibility,created_at,profiles!inner(username,account_status)").eq("moderation_status", "active").neq("visibility", "private").order("created_at", { ascending: false }).limit(opts.limit ?? 40);
  if (opts.username) q = q.eq("profiles.username", opts.username);
  const { data } = await q; const rows = (data ?? []) as unknown as { id: string; user_id: string; booking_code: string; bookmaker: string | null; match_id: string | null; odds: number | null; note: string | null; proof_path: string | null; verification_status: string; visibility: string; created_at: string; profiles: { username: string | null; account_status: string } }[];
  const vis = rows.filter(r => r.profiles.username && r.profiles.account_status !== "banned" && !hide.has(r.user_id) && (r.visibility === "public" || r.user_id === viewerId || follows.has(r.user_id))); if (!vis.length) return [];
  const ids = vis.map(r => r.id), [likes, comments] = await Promise.all([db.from("community_booking_likes").select("post_id").in("post_id", ids), db.from("community_booking_comments").select("post_id").in("post_id", ids).eq("status", "visible")]);
  const count = (d: { post_id: string }[] | null) => { const m = new Map<string, number>(); (d ?? []).forEach(r => m.set(r.post_id, (m.get(r.post_id) ?? 0) + 1)); return m; }, lk = count(likes.data as never), cm = count(comments.data as never);
  return vis.map(r => ({ id: r.id, bookingCode: r.booking_code, bookmaker: r.bookmaker, matchId: r.match_id, odds: r.odds, note: r.note, hasProof: !!r.proof_path, verification: r.verification_status, createdAt: r.created_at, username: r.profiles.username!, likes: lk.get(r.id) ?? 0, comments: cm.get(r.id) ?? 0 }));
}
