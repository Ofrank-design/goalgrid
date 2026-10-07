import { NextResponse } from "next/server";
import { requireUser, fail } from "@/lib/community/api";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { validUsername } from "@/lib/community/rules";
import { LIMIT_MESSAGE, allow } from "@/lib/security/limits";
export async function POST(req: Request) {
  const u = await requireUser(); if (!u) return fail("Sign in first.", 401);
  if (!(await allow(u.id, "profileEdit"))) return fail(LIMIT_MESSAGE, 429);
  const name = String(((await req.json().catch(() => null)) as { username?: unknown } | null)?.username ?? "").toLowerCase().trim();
  if (!validUsername(name)) return fail("Use 3 to 20 letters, numbers or underscores.", 400);
  const { error } = await supabaseAdmin().from("profiles").update({ username: name }).eq("id", u.id);
  if (error) return fail(error.code === "23505" ? "That username is taken." : "Could not save your username.", error.code === "23505" ? 409 : 500);
  return NextResponse.json({ username: name });
}
