import { NextResponse } from "next/server";
import { z } from "zod";
import { fail, requireMember } from "@/lib/community/api";
import { REPORT_CATEGORIES, REPORT_HIDE_THRESHOLD } from "@/lib/community/rules";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { LIMIT_MESSAGE, allow } from "@/lib/security/limits";
import { log } from "@/lib/logging/logger";
/** Reports are counted per distinct user. Enough of them hide the post until a moderator looks (admin tools arrive in Phase 8). */
export async function POST(req: Request) {
  const me = await requireMember(); if (me instanceof NextResponse) return me;
  if (!(await allow(me.id, "report"))) return fail(LIMIT_MESSAGE, 429);
  const p = z.object({ postId: z.string().uuid(), reason: z.string().max(200).optional(), category: z.enum(REPORT_CATEGORIES).default("other") }).safeParse(await req.json().catch(() => null)); if (!p.success) return fail("Invalid request.", 400);
  const db = supabaseAdmin(), { data: post } = await db.from("posts").select("id,user_id,circle_id").eq("id", p.data.postId).eq("status", "visible").maybeSingle(); if (!post) return fail("Post not found.", 404); if (post.circle_id) { const { data: member } = await db.from("private_circle_members").select("circle_id").eq("circle_id", post.circle_id).eq("user_id", me.id).maybeSingle(); if (!member) return fail("Post not found.", 404); }
  if (post.user_id === me.id) return fail("You can't report your own post.", 400);
  await db.from("post_reports").upsert({ post_id: p.data.postId, reporter_id: me.id, reason: (p.data.reason ?? "").slice(0, 200), category: p.data.category }, { onConflict: "post_id,reporter_id" });
  const { count } = await db.from("post_reports").select("post_id", { count: "exact", head: true }).eq("post_id", p.data.postId);
  if ((count ?? 0) >= REPORT_HIDE_THRESHOLD) { await db.from("posts").update({ status: "hidden" }).eq("id", p.data.postId); log.info("post auto hidden", { postId: p.data.postId }); }
  return NextResponse.json({ reported: true });
}
