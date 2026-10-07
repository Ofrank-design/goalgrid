import "server-only";
import { supabaseServer } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import type { Role } from "./moderation";
/** The signed in staff member, or null. The role always comes from the database (or the ADMIN_EMAILS list for confirmed accounts), never from the browser. */
export async function getStaff(): Promise<{ id: string; email: string | null; role: Role } | null> {
  try {
    const { data: { user } } = await (await supabaseServer()).auth.getUser(); if (!user) return null;
    const list = (process.env.ADMIN_EMAILS ?? "").split(",").map(s => s.trim().toLowerCase()).filter(Boolean), email = user.email?.toLowerCase() ?? null;
    if (email && user.email_confirmed_at && list.includes(email)) return { id: user.id, email, role: "admin" };
    const { data } = await supabaseAdmin().from("profiles").select("role,account_status").eq("id", user.id).maybeSingle();
    return data && (data.role === "moderator" || data.role === "admin") && data.account_status !== "banned" && data.account_status !== "suspended" ? { id: user.id, email, role: data.role as Role } : null;
  } catch { return null; }
}
