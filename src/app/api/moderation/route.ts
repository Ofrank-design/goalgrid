import { NextResponse } from "next/server";
import { z } from "zod";
import { MOD_FLOW, VERIFY_FLOW } from "@/lib/community/booking";
import { can, canActOnUser, reasonOk, suspendDaysAllowed, type ModAction, type Role } from "@/lib/community/moderation";
import { getStaff } from "@/lib/community/staff";
import { supabaseAdmin } from "@/lib/supabase/admin";
const body = z.object({ type: z.enum(["booking", "post", "user", "share"]), id: z.string().min(1).max(60), action: z.enum(["hide", "remove", "restore", "review", "verify", "reject", "warn", "suspend", "ban", "unban"]), reason: z.string(), days: z.number().int().optional() });
const out = (error: string, status: number) => NextResponse.json({ error }, { status });
/** The only way to change moderation or verification state. Role is read from the database for every call, the transition must be allowed from the current state, and every action writes an append only audit row with actor, target, prior state, new state and reason. */
export async function POST(req: Request) {
  const staff = await getStaff(); if (!staff) return out("Not found", 404);
  const p = body.safeParse(await req.json().catch(() => null)); if (!p.success) return out("Invalid request", 400); const { type, id, action, reason, days } = p.data, a = action as ModAction;
  if (!reasonOk(reason)) return out("Give a short reason (5 to 300 characters).", 400); if (!can(staff.role, a)) return out("You can't do that.", 403);
  const db = supabaseAdmin(), audit = (row: Record<string, unknown>) => db.from("moderation_actions").insert({ actor_id: staff.id, admin_email: staff.email, action, reason: reason.trim(), target_type: type, ...row });
  if (type === "booking") {
    const { data: b } = await db.from("community_booking_posts").select("id,verification_status,moderation_status").eq("id", id).maybeSingle(); if (!b) return out("Not found", 404);
    if (VERIFY_FLOW[action]) { const f = VERIFY_FLOW[action]; if (!f.from.includes(b.verification_status)) return out(`A share that is ${b.verification_status} can't be ${action}d.`, 409);
      await db.from("community_booking_posts").update({ verification_status: f.to, ...(f.to === "verified" ? { verified_at: new Date().toISOString(), verified_by: staff.id } : {}) }).eq("id", id);
      await db.from("booking_verification_audits").insert({ post_id: id, actor_id: staff.id, prior_state: b.verification_status, new_state: f.to, reason: reason.trim() }); await audit({ target_id: id, prior_state: b.verification_status, new_state: f.to }); return NextResponse.json({ ok: true, state: f.to }); }
    const f = MOD_FLOW[action]; if (!f) return out("That action doesn't apply to a share.", 400); if (!f.from.includes(b.moderation_status)) return out(`A share that is ${b.moderation_status} can't be ${action}d.`, 409);
    await db.from("community_booking_posts").update({ moderation_status: f.to, moderation_reason: reason.trim() }).eq("id", id); await audit({ target_id: id, prior_state: b.moderation_status, new_state: f.to }); return NextResponse.json({ ok: true, state: f.to });
  }
  if (type === "post") {
    const { data: post } = await db.from("posts").select("id,status").eq("id", id).maybeSingle(); if (!post) return out("Not found", 404); const to = a === "restore" ? "visible" : a === "hide" ? "hidden" : a === "remove" ? "removed" : null; if (!to) return out("That action doesn't apply to a post.", 400); if (post.status === to) return out("Already in that state.", 409);
    await db.from("posts").update({ status: to }).eq("id", id); await audit({ target_id: id, post_id: id, prior_state: post.status, new_state: to }); return NextResponse.json({ ok: true, state: to });
  }
  if (type === "share") {
    const { data: sh } = await db.from("simulation_shares").select("id,status").eq("id", id).maybeSingle(); if (!sh) return out("Not found", 404); const to = a === "restore" ? "active" : a === "hide" ? "hidden" : a === "remove" ? "removed" : null; if (!to) return out("That action doesn't apply to a shared strategy.", 400); if (sh.status === to) return out("Already in that state.", 409);
    await db.from("simulation_shares").update({ status: to }).eq("id", id); await audit({ target_id: id, prior_state: sh.status, new_state: to }); return NextResponse.json({ ok: true, state: to });
  }
  const { data: u } = await db.from("profiles").select("id,role,account_status").eq("username", id).maybeSingle(); if (!u) return out("Not found", 404); if (!canActOnUser(staff.role, u.role as Role)) return out("You can't act on this account.", 403);
  const status = u.account_status as string, next: Record<string, { from: string[]; to: string }> = { warn: { from: ["active", "warned"], to: "warned" }, suspend: { from: ["active", "warned"], to: "suspended" }, ban: { from: ["active", "warned", "suspended"], to: "banned" }, unban: { from: ["banned", "suspended"], to: "active" } }, f = next[action];
  if (!f) return out("That action doesn't apply to an account.", 400); if (!f.from.includes(status)) return out(`An account that is ${status} can't be ${action}ed.`, 409);
  let until: string | null = null; if (action === "suspend") { if (days == null || !suspendDaysAllowed(staff.role, days)) return out(`Choose 1 to ${staff.role === "admin" ? 365 : 7} days.`, 400); until = new Date(Date.now() + days * 86_400_000).toISOString(); }
  await db.from("profiles").update({ account_status: f.to, suspended_until: until }).eq("id", u.id); await audit({ target_id: id, target_user_id: u.id, prior_state: status, new_state: f.to }); return NextResponse.json({ ok: true, state: f.to });
}
