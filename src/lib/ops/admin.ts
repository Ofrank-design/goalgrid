import "server-only";
import { supabaseServer } from "@/lib/supabase/server";
/** Admins are the confirmed emails listed in ADMIN_EMAILS. Checked on the server for every admin page and action. */
export async function getAdmin(): Promise<{ id: string; email: string } | null> {
  try {
    const list = (process.env.ADMIN_EMAILS ?? "").split(",").map(s => s.trim().toLowerCase()).filter(Boolean); if (!list.length) return null;
    const { data: { user } } = await (await supabaseServer()).auth.getUser(); const email = user?.email?.toLowerCase();
    return user && email && user.email_confirmed_at && list.includes(email) ? { id: user.id, email } : null;
  } catch { return null; }
}
export const siteUrl = (req?: Request) => (process.env.SITE_URL ?? (req ? new URL(req.url).origin : "")).replace(/\/$/, "");
export const emailSecret = () => process.env.EMAIL_SECRET ?? process.env.CRON_SECRET ?? "";
