import { NextResponse } from "next/server";
import { z } from "zod";
import { getAdmin } from "@/lib/ops/admin";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { LIMIT_MESSAGE, allow } from "@/lib/security/limits";
export async function POST(req: Request) {
  const admin = await getAdmin(); if (!admin) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!(await allow(admin.id, "adminAction"))) return NextResponse.json({ error: LIMIT_MESSAGE }, { status: 429 });
  const p = z.object({ postId: z.string().uuid(), action: z.enum(["restore", "remove"]) }).safeParse(await req.json().catch(() => null)); if (!p.success) return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  const db = supabaseAdmin(); await db.from("posts").update({ status: p.data.action === "restore" ? "visible" : "removed" }).eq("id", p.data.postId);
  if (p.data.action === "restore") await db.from("post_reports").delete().eq("post_id", p.data.postId);
  await db.from("moderation_actions").insert({ post_id: p.data.postId, admin_email: admin.email, action: p.data.action });
  return NextResponse.json({ ok: true });
}
