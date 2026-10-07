import { NextResponse } from "next/server";
import { z } from "zod";
import { fail, requireMember } from "@/lib/community/api";
import { REPORTS_TO_REVIEW } from "@/lib/community/booking";
import { hiddenAuthors } from "@/lib/community/bookings-server";
import { REPORT_CATEGORIES, validateBody } from "@/lib/community/rules";
import { parseBlocked } from "@/lib/community/rules";
import { LIMIT_MESSAGE, allow } from "@/lib/security/limits";
import { supabaseAdmin } from "@/lib/supabase/admin";
const body = z.discriminatedUnion("action", [z.object({ action: z.literal("like") }), z.object({ action: z.literal("comment"), body: z.string() }), z.object({ action: z.literal("report"), category: z.enum(REPORT_CATEGORIES).default("other"), reason: z.string().max(200).optional() })]);
/** Like, comment or report a share. The share must be active and visible to this user; blocked pairs cannot interact. */
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const me = await requireMember(); if (me instanceof NextResponse) return me; const { id } = await ctx.params;
  const p = body.safeParse(await req.json().catch(() => null)); if (!z.string().uuid().safeParse(id).success || !p.success) return fail("Invalid request.", 400);
  const db = supabaseAdmin(), { data: post } = await db.from("community_booking_posts").select("id,user_id,visibility,moderation_status").eq("id", id).maybeSingle();
  if (!post || post.moderation_status !== "active" || (post.visibility === "private" && post.user_id !== me.id) || (await hiddenAuthors(me.id)).has(post.user_id as string)) return fail("Not found.", 404);
  if (p.data.action === "like") { if (!(await allow(me.id, "like"))) return fail(LIMIT_MESSAGE, 429); const { data: had } = await db.from("community_booking_likes").select("post_id").eq("post_id", id).eq("user_id", me.id).maybeSingle();
    if (had) await db.from("community_booking_likes").delete().eq("post_id", id).eq("user_id", me.id); else await db.from("community_booking_likes").insert({ post_id: id, user_id: me.id }); return NextResponse.json({ liked: !had }); }
  if (p.data.action === "comment") { if (!(await allow(me.id, "comment"))) return fail(LIMIT_MESSAGE, 429); const v = validateBody(p.data.body, parseBlocked(process.env.BLOCKED_TERMS)); if (!v.ok) return fail(v.error, 400); if (v.text.length > 300) return fail("Keep it under 300 characters.", 400);
    const { error } = await db.from("community_booking_comments").insert({ post_id: id, user_id: me.id, body: v.text }); return error ? fail("Could not comment.", 500) : NextResponse.json({ commented: true }, { status: 201 }); }
  if (post.user_id === me.id) return fail("You can't report your own share.", 400); if (!(await allow(me.id, "report"))) return fail(LIMIT_MESSAGE, 429);
  await db.from("community_booking_reports").upsert({ post_id: id, reporter_id: me.id, category: p.data.category, reason: (p.data.reason ?? "").slice(0, 200) || null }, { onConflict: "post_id,reporter_id" });
  const { count } = await db.from("community_booking_reports").select("post_id", { count: "exact", head: true }).eq("post_id", id);
  if ((count ?? 0) >= REPORTS_TO_REVIEW) await db.from("community_booking_posts").update({ moderation_status: "under_review" }).eq("id", id).eq("moderation_status", "active");
  return NextResponse.json({ reported: true });
}
