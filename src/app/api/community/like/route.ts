import { NextResponse } from "next/server";
import { z } from "zod";
import { fail, requireMember } from "@/lib/community/api";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { createNotification } from "@/lib/notifications/server";
import { LIMIT_MESSAGE, allow } from "@/lib/security/limits";
export async function POST(req: Request) {
  const me = await requireMember(); if (me instanceof NextResponse) return me;
  if (!(await allow(me.id, "like"))) return fail(LIMIT_MESSAGE, 429);
  const p = z.object({ postId: z.string().uuid() }).safeParse(await req.json().catch(() => null)); if (!p.success) return fail("Invalid request.", 400);
  const db = supabaseAdmin(), { data: post } = await db.from("posts").select("id,user_id,circle_id").eq("id", p.data.postId).eq("status", "visible").maybeSingle(); if (!post) return fail("Post not found.", 404); if (post.circle_id) { const { data: member } = await db.from("private_circle_members").select("circle_id").eq("circle_id", post.circle_id).eq("user_id", me.id).maybeSingle(); if (!member) return fail("Post not found.", 404); }
  const { data: had } = await db.from("post_likes").select("post_id").eq("post_id", p.data.postId).eq("user_id", me.id).maybeSingle();
  if (had) await db.from("post_likes").delete().eq("post_id", p.data.postId).eq("user_id", me.id); else { await db.from("post_likes").insert({ post_id: p.data.postId, user_id: me.id }); if (post.user_id !== me.id) await createNotification({ userId: post.user_id as string, actorId: me.id, type: "like", title: "Someone liked your post", body: "Your GoalGrid community post received a like.", href: "/community" }); }
  return NextResponse.json({ liked: !had });
}
