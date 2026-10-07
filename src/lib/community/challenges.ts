import "server-only";
import { cached } from "@/lib/cache";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { getFixtures } from "@/lib/engine/ingestion/fixtures";
import { shiftDate } from "@/lib/app/format";
import { createNotification } from "@/lib/notifications/server";

export interface ChallengeRow { id: string; slug: string; title: string; description: string; starts_at: string; ends_at: string; status: string; created_at: string }
export interface ChallengeMatch { position: number; match_id: string; match_date: string; kickoff_utc: string; league_slug: string; home_name: string; away_name: string }
export interface ChallengeLeaderboardRow { rank: number; username: string; points: number; picks: number; correct: number; accuracy: number }

const weekStartUtc = (date = new Date()) => {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const day = d.getUTCDay();
  d.setUTCDate(d.getUTCDate() - (day === 0 ? 6 : day - 1));
  return d.toISOString().slice(0, 10);
};

/** Read only: this week's challenge if it exists. Safe on every page view. */
export async function findWeeklyChallenge(): Promise<ChallengeRow | null> {
  const { data } = await supabaseAdmin().from("challenges").select("*").eq("slug", `weekly-${weekStartUtc()}`).maybeSingle();
  return (data as ChallengeRow | null) ?? null;
}

/** Finds or creates this week's challenge and keeps its status right. Writes only when something actually changes. Called by the weekly job, and lazily by pages (see currentChallenge). */
export async function ensureWeeklyChallenge(): Promise<ChallengeRow | null> {
  const db = supabaseAdmin();
  const start = weekStartUtc();
  const slug = `weekly-${start}`;
  const endDate = shiftDate(start, 7);
  const existing = await findWeeklyChallenge();
  if (existing) {
    const status = Date.now() >= Date.parse(existing.ends_at) ? "closed" : "active";
    if (existing.status !== status) { await db.from("challenges").update({ status }).eq("id", existing.id); return { ...existing, status } as ChallengeRow; }
    return existing;
  }

  const rows: ChallengeMatch[] = [];
  for (let i = 0; i < 8; i++) {
    const date = shiftDate(start, i);
    try {
      const fx = await getFixtures(date);
      for (const m of fx.matches.filter(x => x.status === "scheduled" && Date.parse(x.kickoffUtc) > Date.now() + 30 * 60_000)) {
        rows.push({ position: rows.length + 1, match_id: m.id, match_date: date, kickoff_utc: m.kickoffUtc, league_slug: m.league.slug, home_name: m.home.name, away_name: m.away.name });
      }
    } catch { /* provider failure: try the next date */ }
    if (rows.length >= 10) break;
  }
  if (rows.length < 5) return null;

  const { data: challenge, error } = await db.from("challenges").insert({
    slug,
    title: `Weekly Matchday Challenge · ${start}`,
    description: "Pick the outcome of this week's selected fixtures. Points come from the same server-verified GoalGrid prediction record; no money or prizes of value are involved.",
    starts_at: new Date(`${start}T00:00:00Z`).toISOString(),
    ends_at: new Date(`${endDate}T23:59:59Z`).toISOString(),
    status: "active",
  }).select("*").single();
  if (error || !challenge) return null;
  const selected = rows.slice(0, 10).map((r, i) => ({ ...r, challenge_id: challenge.id, position: i + 1 }));
  const ins = await db.from("challenge_matches").insert(selected);
  if (ins.error) {
    await db.from("challenges").delete().eq("id", challenge.id);
    return null;
  }
  return challenge as ChallengeRow;
}

export async function getChallenge(id: string, userId?: string) {
  const db = supabaseAdmin();
  const [{ data: challenge }, { data: matches }] = await Promise.all([
    db.from("challenges").select("*").eq("id", id).maybeSingle(),
    db.from("challenge_matches").select("position,match_id,match_date,kickoff_utc,league_slug,home_name,away_name").eq("challenge_id", id).order("position"),
  ]);
  if (!challenge) return null;
  let joined = false;
  let picks: Record<string, { pick: string; confidence: number }> = {};
  if (userId) {
    const [{ data: entry }, { data: mine }] = await Promise.all([
      db.from("challenge_entries").select("challenge_id").eq("challenge_id", id).eq("user_id", userId).maybeSingle(),
      db.from("user_predictions").select("match_id,pick,confidence").eq("user_id", userId).in("match_id", (matches ?? []).map(m => m.match_id as string)),
    ]);
    joined = Boolean(entry);
    picks = Object.fromEntries((mine ?? []).map(p => [p.match_id as string, { pick: p.pick as string, confidence: Number(p.confidence) }]));
  }
  return { challenge: challenge as ChallengeRow, matches: (matches ?? []) as ChallengeMatch[], joined, picks };
}

export async function joinChallenge(challengeId: string, userId: string) {
  const db = supabaseAdmin();
  const { data: challenge } = await db.from("challenges").select("id,title,status").eq("id", challengeId).maybeSingle();
  if (!challenge || challenge.status !== "active") return { ok: false, error: "Challenge is not active." };
  const { error } = await db.from("challenge_entries").upsert({ challenge_id: challengeId, user_id: userId }, { onConflict: "challenge_id,user_id" });
  if (error) return { ok: false, error: "Could not join challenge." };
  await createNotification({ userId, type: "challenge", title: "Challenge joined", body: `You're in ${challenge.title}. Make your picks before kickoff.`, href: `/challenges/${challengeId}`, dedupeKey: `challenge:join:${challengeId}:${userId}` });
  return { ok: true };
}

export async function getChallengeLeaderboard(challengeId: string, limit = 100): Promise<ChallengeLeaderboardRow[]> {
  const db = supabaseAdmin();
  const [{ data: entries }, { data: matches }] = await Promise.all([
    db.from("challenge_entries").select("user_id").eq("challenge_id", challengeId).limit(2000),
    db.from("challenge_matches").select("match_id").eq("challenge_id", challengeId).order("position"),
  ]);
  const users = [...new Set((entries ?? []).map(e => e.user_id as string))];
  const ids = (matches ?? []).map(m => m.match_id as string);
  if (!users.length || !ids.length) return [];
  const [{ data: picks }, { data: profiles }] = await Promise.all([
    db.from("user_predictions").select("user_id,match_id,outcome,points,settled_at").in("user_id", users).in("match_id", ids),
    db.from("profiles").select("id,username").in("id", users),
  ]);
  const names = new Map((profiles ?? []).map(p => [p.id as string, (p.username as string | null) ?? `user-${String(p.id).slice(0, 6)}`]));
  const sums = new Map<string, { points: number; picks: number; correct: number }>();
  for (const id of users) sums.set(id, { points: 0, picks: 0, correct: 0 });
  for (const p of picks ?? []) {
    if (!p.settled_at || p.outcome === "void") continue;
    const row = sums.get(p.user_id as string); if (!row) continue;
    row.points += Number(p.points ?? 0); row.picks += 1; row.correct += p.outcome != null && Number(p.points ?? 0) > 0 ? 1 : 0;
  }
  return [...sums.entries()].map(([id, r]) => ({ username: names.get(id)!, points: r.points, picks: r.picks, correct: r.correct, accuracy: r.picks ? Math.round(r.correct / r.picks * 100) : 0, rank: 0 }))
    .sort((a, b) => b.points - a.points || b.accuracy - a.accuracy || b.picks - a.picks).slice(0, limit).map((r, i) => ({ ...r, rank: i + 1 }));
}

export function challengeIsOpen(c: ChallengeRow) {
  const now = Date.now();
  return c.status === "active" && now >= Date.parse(c.starts_at) && now <= Date.parse(c.ends_at);
}

export function getChallengeStatus(c: ChallengeRow) {
  const now = Date.now();
  if (now > Date.parse(c.ends_at)) return "closed";
  if (now >= Date.parse(c.starts_at)) return "active";
  return "scheduled";
}

export const currentChallenge = async (userId?: string) => {
  // Pages only read. Creating a challenge fetches up to 8 days of fixtures, so a missing one is attempted at most every 30 minutes per instance.
  const ensured = (await findWeeklyChallenge()) ?? (await cached("weekly-challenge-ensure", 30 * 60_000, 0, ensureWeeklyChallenge).then(r => r.value).catch(() => null));
  if (!ensured) return null;
  return getChallenge(ensured.id, userId);
};
