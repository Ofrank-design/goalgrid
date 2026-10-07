import { NextResponse } from "next/server";
import { z } from "zod";
import { fail, requireUser } from "@/lib/community/api";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { LIMIT_MESSAGE, allow } from "@/lib/security/limits";
export async function POST(req: Request) {
  const u = await requireUser(); if (!u) return fail("Sign in first.", 401);
  if (!(await allow(u.id, "remove"))) return fail(LIMIT_MESSAGE, 429);
  const p = z.object({ postId: z.string().uuid() }).safeParse(await req.json().catch(() => null)); if (!p.success) return fail("Invalid request.", 400);
  const { data } = await supabaseAdmin().from("posts").update({ status: "removed" }).eq("id", p.data.postId).eq("user_id", u.id).select("id");
  return data?.length ? NextResponse.json({ removed: true }) : fail("Post not found.", 404);
}
