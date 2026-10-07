import { NextResponse } from "next/server";
import { z } from "zod";
import { fail, requireMember } from "@/lib/community/api";
import { LIMIT_MESSAGE, allow } from "@/lib/security/limits";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { createNotification } from "@/lib/notifications/server";
const body = z.object({ username: z.string().regex(/^[a-z0-9_]{3,20}$/), action: z.enum(["follow", "unfollow", "block", "unblock", "mute", "unmute"]) });
/** Follow, block and mute by username. Blocking also removes any follow in both directions. */
export async function POST(req: Request) {
  const me = await requireMember(); if (me instanceof NextResponse) return me; const p = body.safeParse(await req.json().catch(() => null)); if (!p.success) return fail("Invalid request.", 400);
  if (!(await allow(me.id, "follow"))) return fail(LIMIT_MESSAGE, 429);
  const db = supabaseAdmin(), { data: t } = await db.from("profiles").select("id,role").eq("username", p.data.username).maybeSingle(); if (!t || t.id === me.id) return fail("Not found.", 404);
  const a = p.data.action;
  if (a === "follow") { const { count } = await db.from("blocks").select("blocker_id", { count: "exact", head: true }).or(`and(blocker_id.eq.${me.id},blocked_id.eq.${t.id}),and(blocker_id.eq.${t.id},blocked_id.eq.${me.id})`); if ((count ?? 0) > 0) return fail("Not found.", 404); await db.from("follows").upsert({ follower_id: me.id, followee_id: t.id }, { ignoreDuplicates: true }); await createNotification({ userId: t.id as string, actorId: me.id, type: "follow", title: "New follower", body: `@${p.data.username} followed you on GoalGrid.`, href: `/profile/${p.data.username}` }); }
  if (a === "unfollow") await db.from("follows").delete().eq("follower_id", me.id).eq("followee_id", t.id);
  if (a === "block") { if (t.role !== "user") return fail("You can't block staff. Use Report instead.", 400); await db.from("blocks").upsert({ blocker_id: me.id, blocked_id: t.id }, { ignoreDuplicates: true }); await db.from("follows").delete().or(`and(follower_id.eq.${me.id},followee_id.eq.${t.id}),and(follower_id.eq.${t.id},followee_id.eq.${me.id})`); }
  if (a === "unblock") await db.from("blocks").delete().eq("blocker_id", me.id).eq("blocked_id", t.id);
  if (a === "mute") await db.from("mutes").upsert({ muter_id: me.id, muted_id: t.id }, { ignoreDuplicates: true }); if (a === "unmute") await db.from("mutes").delete().eq("muter_id", me.id).eq("muted_id", t.id);
  return NextResponse.json({ ok: true });
}
