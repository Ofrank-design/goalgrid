import { NextResponse } from "next/server";
import { z } from "zod";
import { fail, requireMember } from "@/lib/community/api";
import { POST_LIMIT, parseBlocked, validateBody } from "@/lib/community/rules";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { LIMIT_MESSAGE, allow } from "@/lib/security/limits";
import { createNotification } from "@/lib/notifications/server";
const schema = z.object({ matchId: z.string().regex(/^(sm|fd):\d+$/).nullable().optional(), parentId: z.string().uuid().nullable().optional(), circleId: z.string().uuid().nullable().optional(), body: z.string() });
export async function POST(req: Request) {
  const me = await requireMember(); if (me instanceof NextResponse) return me;
  if (!(await allow(me.id, "post"))) return fail(LIMIT_MESSAGE, 429);
  const p = schema.safeParse(await req.json().catch(() => null)); if (!p.success) return fail("Invalid request.", 400);
  const v = validateBody(p.data.body, parseBlocked(process.env.BLOCKED_TERMS)); if (!v.ok) return fail(v.error, 400);
  const db = supabaseAdmin(), since = new Date(Date.now() - POST_LIMIT.windowMin * 60_000).toISOString();
  const { count } = await db.from("posts").select("id", { count: "exact", head: true }).eq("user_id", me.id).gte("created_at", since);
  if ((count ?? 0) >= POST_LIMIT.max) return fail("You are posting too fast. Try again in a few minutes.", 429);
  const matchId = p.data.matchId ?? null, parentId = p.data.parentId ?? null, circleId = p.data.circleId ?? null;
  if (circleId) { const { data: member } = await db.from("private_circle_members").select("circle_id").eq("circle_id", circleId).eq("user_id", me.id).maybeSingle(); if (!member) return fail("Join that circle before posting.", 403); }
  if (parentId) { const { data: parent } = await db.from("posts").select("match_id,parent_id,status,circle_id").eq("id", parentId).maybeSingle(); if (!parent || parent.status !== "visible" || parent.parent_id || (parent.match_id ?? null) !== matchId || ((parent.circle_id ?? null) !== circleId)) return fail("You can't reply to that post.", 400); }
  const { data, error } = await db.from("posts").insert({ user_id: me.id, match_id: matchId, parent_id: parentId, body: v.text, circle_id: circleId }).select("id").single();
  if (error) return fail("Could not post. Try again.", 500);
  if (parentId) { const { data: parentPost } = await db.from("posts").select("user_id").eq("id", parentId).maybeSingle(); if (parentPost?.user_id && parentPost.user_id !== me.id) await createNotification({ userId: parentPost.user_id as string, actorId: me.id, type: "comment", title: "New reply to your post", body: "Someone replied to your GoalGrid community post.", href: "/community" }); }
  return NextResponse.json({ id: data.id }, { status: 201 });
}
