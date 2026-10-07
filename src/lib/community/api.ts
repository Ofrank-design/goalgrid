import "server-only";
import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { accountGate, type AccountStatus } from "./moderation";
export const fail = (error: string, status: number) => NextResponse.json({ error }, { status });
export async function requireUser() { try { const { data: { user } } = await (await supabaseServer()).auth.getUser(); return user ? { id: user.id } : null; } catch { return null; } }
/** The signed in user and their chosen username, or the response to send back instead. */
export async function requireMember(): Promise<{ id: string; username: string; createdAt: string } | NextResponse> {
  const u = await requireUser(); if (!u) return fail("Sign in first.", 401);
  const { data } = await supabaseAdmin().from("profiles").select("username,account_status,suspended_until,created_at").eq("id", u.id).maybeSingle();
  if (!data?.username) return fail("Choose a username first.", 409);
  const g = accountGate((data.account_status ?? "active") as AccountStatus, (data.suspended_until as string | null) ?? null); if (!g.canPost) return fail(g.reason ?? "Posting is paused.", 403);
  return { id: u.id, username: data.username as string, createdAt: data.created_at as string };
}
