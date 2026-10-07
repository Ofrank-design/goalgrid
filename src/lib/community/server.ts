import "server-only";
import { supabaseServer } from "@/lib/supabase/server";
export interface FeedPost { id: string; match_id: string | null; parent_id: string | null; body: string; created_at: string; username: string; likes: number }
export type Thread = FeedPost & { replies: FeedPost[] };
export interface Row { username: string; picks: number; points: number; accuracy: number }
export async function getFeed(matchId: string | null): Promise<Thread[]> {
  try {
    const sb = await supabaseServer(), q = sb.from("posts_feed").select("id,match_id,parent_id,body,created_at,username,likes").order("created_at", { ascending: false }).limit(120);
    const { data } = await (matchId ? q.eq("match_id", matchId) : q.is("match_id", null)); const all = (data ?? []) as FeedPost[];
    return all.filter(p => !p.parent_id).slice(0, 40).map(p => ({ ...p, replies: all.filter(r => r.parent_id === p.id).reverse() }));
  } catch { return []; }
}
export async function getLeaderboard(kind: "week" | "all", limit = 50): Promise<Row[]> {
  try { const { data } = await (await supabaseServer()).from(kind === "week" ? "leaderboard_week" : "leaderboard_all").select("username,picks,points,accuracy").order("points", { ascending: false }).limit(limit); return (data ?? []) as Row[]; } catch { return []; }
}
export async function getMe(): Promise<{ signedIn: boolean; username: string | null }> {
  try {
    const sb = await supabaseServer(), { data: { user } } = await sb.auth.getUser(); if (!user) return { signedIn: false, username: null };
    const { data } = await sb.from("profiles").select("username").eq("id", user.id).maybeSingle(); return { signedIn: true, username: (data?.username as string | null) ?? null };
  } catch { return { signedIn: false, username: null }; }
}
export async function getMyPick(matchId: string): Promise<{ pick: string; confidence: number } | null> {
  try { const sb = await supabaseServer(), { data: { user } } = await sb.auth.getUser(); if (!user) return null; const { data } = await sb.from("user_predictions").select("pick,confidence").eq("match_id", matchId).maybeSingle(); return data as { pick: string; confidence: number } | null; } catch { return null; }
}
/** The signed in user's extra picks for a match, keyed by market. Read through row level security, so only their own rows are visible. */
export async function getMyMarketPicks(matchId: string): Promise<Record<string, string>> {
  try { const sb = await supabaseServer(), { data } = await sb.from("user_market_picks").select("market,value").eq("match_id", matchId); return Object.fromEntries((data ?? []).map(r => [r.market as string, r.value as string])); } catch { return {}; }
}
