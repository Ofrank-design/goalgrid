import "server-only";
import { log } from "@/lib/logging/logger";
import { ENGINE_VERSION, FREEZE_MINUTES, planVersion } from "@/lib/engine/versioning";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { getFixtures } from "@/lib/engine/ingestion/fixtures";
import { getPredictions } from "@/lib/engine/predictions";
import { sendEmail, emailConfigured } from "@/lib/providers/resend";
import { todayUtc, shiftDate } from "@/lib/app/format";
import { evaluate } from "./eval";
import { buildDigest, type DigestItem } from "./digest";
import { emailSecret } from "./admin";
import { signToken } from "./tokens";
import { purgeExpiredRuns } from "@/lib/simulation/retention";
import { pruneEngineCache } from "@/lib/engine/predictions/store";
import { ensureWeeklyChallenge } from "@/lib/community/challenges";
/** Every job is recorded in ingestion_jobs, so the admin page shows what ran, when, and what happened. */
async function tracked<T extends Record<string, unknown>>(job: string, fn: () => Promise<T>): Promise<T> {
  const db = supabaseAdmin(), { data } = await db.from("ingestion_jobs").insert({ job, status: "running", started_at: new Date().toISOString() }).select("id").single();
  try { const r = await fn(); await db.from("ingestion_jobs").update({ status: "succeeded", finished_at: new Date().toISOString(), detail: r }).eq("id", data?.id); return r; }
  catch (e) { await db.from("ingestion_jobs").update({ status: "failed", finished_at: new Date().toISOString(), detail: { error: (e as Error).message } }).eq("id", data?.id); throw e; }
}
/** Writes a numbered version for each prediction that moved enough, and nothing once a match is within the freeze window. */
async function writeVersions(db: ReturnType<typeof supabaseAdmin>, rows: { match_id: string; kickoff_utc: string; p_home: number; p_draw: number; p_away: number; xg_home: number; xg_away: number; btts: number; over25: number; confidence: number; models_used: number }[], items: { match: { id: string }; prediction?: { conformal?: unknown } | null }[]) {
  const { data } = await db.from("prediction_versions").select("match_id,version,engine_version,p_home,p_draw,p_away").in("match_id", rows.map(r => r.match_id)).order("version", { ascending: false }), latest = new Map<string, { version: number; engineVersion: string; pHome: number; pDraw: number; pAway: number }>();
  for (const d of data ?? []) if (!latest.has(d.match_id as string)) latest.set(d.match_id as string, { version: d.version as number, engineVersion: d.engine_version as string, pHome: Number(d.p_home), pDraw: Number(d.p_draw), pAway: Number(d.p_away) });
  const ins = rows.flatMap(r => { const plan = planVersion(latest.get(r.match_id) ?? null, { pHome: r.p_home, pDraw: r.p_draw, pAway: r.p_away }, Date.parse(r.kickoff_utc)); return plan.action === "insert" ? [{ match_id: r.match_id, version: plan.version, engine_version: ENGINE_VERSION, kickoff_utc: r.kickoff_utc, p_home: r.p_home, p_draw: r.p_draw, p_away: r.p_away, xg_home: r.xg_home, xg_away: r.xg_away, btts: r.btts, over25: r.over25, confidence: r.confidence, models_used: r.models_used, conformal: items.find(i => i.match.id === r.match_id)?.prediction?.conformal ?? null }] : []; });
  if (ins.length) { const { error } = await db.from("prediction_versions").upsert(ins, { onConflict: "match_id,version", ignoreDuplicates: true }); if (error) throw new Error(error.message); }
}
/** Warms the model fits and stores a prediction for every upcoming match. A stored prediction is replaced until kickoff, then frozen, so accuracy is judged on what we said beforehand. */
export const refreshJob = () => tracked("refresh", async () => {
  const db = supabaseAdmin(); let saved = 0;
  for (const date of [todayUtc(), shiftDate(todayUtc(), 1)]) {
    const r = await getPredictions(date, { refresh: true });
    const rows = r.items.filter(i => i.prediction && i.match.status === "scheduled" && Date.parse(i.match.kickoffUtc) > Date.now() + FREEZE_MINUTES * 60_000).map(({ match: m, prediction: p }) => ({ match_id: m.id, match_date: date, league_slug: m.league.slug, home_name: m.home.name, away_name: m.away.name, kickoff_utc: m.kickoffUtc,
      p_home: p!.probabilities.home, p_draw: p!.probabilities.draw, p_away: p!.probabilities.away, xg_home: p!.expectedGoals.home, xg_away: p!.expectedGoals.away, btts: p!.btts, over25: p!.over25, confidence: p!.confidence, models_used: p!.modelsUsed, updated_at: new Date().toISOString() }));
    if (rows.length) await writeVersions(db, rows, r.items);
    if (rows.length) { const { error } = await db.from("prediction_snapshots").upsert(rows, { onConflict: "match_id" }); if (error) throw new Error(error.message); saved += rows.length; }
  }
  return { saved };
});
/** Scores stored predictions whose matches have finished. */
export const evaluateJob = () => tracked("evaluate", async () => {
  const db = supabaseAdmin(), cutoff = new Date(Date.now() - 2 * 3_600_000).toISOString();
  const { data: snaps } = await db.from("prediction_snapshots").select("match_id,match_date,p_home,p_draw,p_away,btts,over25,kickoff_utc").lt("kickoff_utc", cutoff).order("kickoff_utc", { ascending: false }).limit(400);
  const { data: done } = await db.from("prediction_results").select("match_id").in("match_id", (snaps ?? []).map(s => s.match_id as string)), have = new Set((done ?? []).map(d => d.match_id as string));
  const todo = (snaps ?? []).filter(s => !have.has(s.match_id as string)); let evaluated = 0;
  for (const date of new Set<string>(todo.map(s => String(s.match_date)))) {
    let fx; try { fx = await getFixtures(date); } catch { continue; }
    for (const s of todo.filter(t => t.match_date === date)) { const m = fx.matches.find(x => x.id === s.match_id); if (m?.status !== "finished" || m.score.home == null || m.score.away == null) continue;
      const e = evaluate({ home: Number(s.p_home), draw: Number(s.p_draw), away: Number(s.p_away), btts: s.btts == null ? null : Number(s.btts), over25: s.over25 == null ? null : Number(s.over25) }, m.score.home, m.score.away);
      const { error } = await db.from("prediction_results").upsert({ match_id: s.match_id, outcome: e.outcome, home_goals: m.score.home, away_goals: m.score.away, log_loss: e.logLoss, brier: e.brier, correct: e.correct, btts_correct: e.bttsCorrect, over25_correct: e.over25Correct }, { onConflict: "match_id" }); if (!error) evaluated++; }
  }
  return { evaluated };
});
/** Creates the current weekly challenge only when enough upcoming real fixtures exist. */
export const weeklyChallengeJob = () => tracked("challenge-weekly", async () => {
  const c = await ensureWeeklyChallenge();
  return { created: Boolean(c), challengeId: c?.id ?? null };
});

const DAILY_CAP = () => Number(process.env.EMAIL_DAILY_CAP ?? 90);
/** The daily digest goes to confirmed subscribers and to accounts that opted in. It runs once a day unless forced, and never beyond the daily email cap. */
export const digestJob = (opts: { force?: boolean; only?: string } = {}) => tracked("digest", async () => {
  if (!emailConfigured()) return { skipped: "email not configured" } as Record<string, unknown>;
  const db = supabaseAdmin(), today = todayUtc(), site = (process.env.SITE_URL ?? "").replace(/\/$/, ""); if (!site) return { skipped: "SITE_URL not set" };
  if (!opts.force && !opts.only) { const { count } = await db.from("email_log").select("id", { count: "exact", head: true }).eq("kind", "digest").gte("created_at", today + "T00:00:00Z"); if ((count ?? 0) > 0) return { skipped: "already sent today" }; }
  const r = await getPredictions(today), items: DigestItem[] = r.items.filter(i => i.prediction && i.match.status === "scheduled").sort((a, b) => b.prediction!.confidence - a.prediction!.confidence).slice(0, 6)
    .map(({ match: m, prediction: p }) => ({ league: m.league.name, home: m.home.name, away: m.away.name, kickoffUtc: m.kickoffUtc, probs: [p!.probabilities.home, p!.probabilities.draw, p!.probabilities.away] as [number, number, number], score: `${p!.mostLikelyScore.home}-${p!.mostLikelyScore.away}` }));
  if (!items.length) return { skipped: "no predictions today" };
  const recipients: { email: string; subject: string; kind: "sub" | "user" }[] = [];
  if (opts.only) recipients.push({ email: opts.only, subject: opts.only, kind: "sub" });
  else {
    const { data: subs } = await db.from("email_subscribers").select("email").not("confirmed_at", "is", null).is("unsubscribed_at", null); (subs ?? []).forEach(s => recipients.push({ email: s.email as string, subject: s.email as string, kind: "sub" }));
    const { data: prefs } = await db.from("user_preferences").select("user_id").eq("email_updates", true), want = new Set((prefs ?? []).map(p => p.user_id as string));
    if (want.size) { const { data: list } = await db.auth.admin.listUsers({ page: 1, perPage: 1000 }); for (const u of list?.users ?? []) if (want.has(u.id) && u.email && !recipients.some(x => x.email === u.email!.toLowerCase())) recipients.push({ email: u.email.toLowerCase(), subject: u.id, kind: "user" }); }
  }
  let sent = 0, failed = 0; const cap = Math.min(recipients.length, DAILY_CAP());
  for (const rcp of recipients.slice(0, cap)) {
    const unsub = `${site}/api/email/unsubscribe?t=${signToken(rcp.kind === "user" ? "unsub-user" : "unsub-sub", rcp.subject, emailSecret(), 180 * 86_400_000)}`, d = buildDigest(items, today, unsub, site);
    try { await sendEmail({ to: rcp.email, ...d, unsubscribeUrl: unsub }); sent++; await db.from("email_log").insert({ kind: opts.only ? "digest-test" : "digest", recipient: rcp.email, status: "sent" }); }
    catch (e) { failed++; log.warn("digest send failed", { message: (e as Error).message }); await db.from("email_log").insert({ kind: opts.only ? "digest-test" : "digest", recipient: rcp.email, status: "failed", error: (e as Error).message.slice(0, 200) }); }
    await new Promise(r2 => setTimeout(r2, 600));
  }
  return { sent, failed, recipients: recipients.length, capped: recipients.length > cap };
});

export const notificationDeliveryJob = () => tracked("notifications", async () => {
  if (!emailConfigured()) return { skipped: "email not configured", delivered: 0, failed: 0 };
  const db = supabaseAdmin();
  const cap = Math.max(1, Math.min(Number(process.env.NOTIFICATION_EMAIL_BATCH ?? 40), 200));
  const { data: rows } = await db.from("notifications").select("id,user_id,type,title,body,href,delivery_attempts").is("delivered_at", null).lt("delivery_attempts", 5).order("created_at", { ascending: true }).limit(cap);
  let delivered = 0, failed = 0;
  const userIds = [...new Set((rows ?? []).map(r => r.user_id as string))];
  const prefsByUser = new Map<string, Record<string, unknown>>(), emailByUser = new Map<string, string | null>();
  if (userIds.length) { const { data: allPrefs } = await db.from("notification_preferences").select("*").in("user_id", userIds); for (const p of allPrefs ?? []) prefsByUser.set(p.user_id as string, p as Record<string, unknown>); }
  for (const n of rows ?? []) {
    const id = n.id as string, attempts = Number(n.delivery_attempts ?? 0);
    const { data: claimed } = await db.from("notifications").update({ delivery_attempts: attempts + 1 }).eq("id", id).is("delivered_at", null).eq("delivery_attempts", attempts).select("id").maybeSingle();
    if (!claimed) continue;
    try {
      const prefs = prefsByUser.get(n.user_id as string) ?? null;
      if (prefs?.email !== true || prefs?.[String(n.type)] === false) { await db.from("notifications").update({ delivered_at: new Date().toISOString(), last_delivery_error: null }).eq("id", id); continue; }
      const uid = n.user_id as string;
      if (!emailByUser.has(uid)) { const { data: account } = await db.auth.admin.getUserById(uid); emailByUser.set(uid, account.user?.email ?? null); }
      const email = emailByUser.get(uid);
      if (!email) { await db.from("notifications").update({ delivered_at: new Date().toISOString(), last_delivery_error: "No email address" }).eq("id", id); continue; }
      const site = (process.env.SITE_URL ?? "").replace(/\/$/, ""), href = n.href ? `${site}${String(n.href).startsWith("/") ? n.href : `/${n.href}`}` : site;
      const esc = (v: string) => v.replace(/[&<>\"]/g, ch => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[ch]!));
      await sendEmail({ to: email, subject: `GoalGrid: ${String(n.title)}`, text: `${String(n.body)}${href ? `\n\nOpen GoalGrid: ${href}` : ""}`, html: `<div style="font-family:system-ui,sans-serif"><h2>${esc(String(n.title))}</h2><p>${esc(String(n.body))}</p>${href ? `<p><a href="${esc(href)}">Open GoalGrid</a></p>` : ""}</div>` });
      await db.from("notifications").update({ delivered_at: new Date().toISOString(), last_delivery_error: null }).eq("id", id); delivered++;
    } catch (e) { failed++; await db.from("notifications").update({ last_delivery_error: (e as Error).message.slice(0, 400) }).eq("id", id); log.warn("notification email failed", { notificationId: id, message: (e as Error).message }); }
  }
  return { delivered, failed, scanned: rows?.length ?? 0 };
});


/** Removes expired synthetic simulation runs. Raw event-heavy data is intentionally retained for a bounded period. */
export const simulationCleanupJob = () => tracked("simulation-cleanup", purgeExpiredRuns);
/** Nightly housekeeping: expired simulation runs, and rate limit events older than two days (the table grows with every limited request). */
export const maintenanceJob = () => tracked("maintenance", async () => {
  const runs = await purgeExpiredRuns();
  const { error } = await supabaseAdmin().rpc("prune_rate_events");
  if (error) throw new Error(error.message);
  await pruneEngineCache();
  return { ...runs, rateEventsPruned: true, engineCachePruned: true };
});
