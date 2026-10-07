import "server-only";
import { supabaseServer } from "@/lib/supabase/server";
import { currentTier, type Tier } from "@/lib/entitlements";
/** The signed in user (if any) and their tier. Falls back to anonymous Free if auth is not configured. */
export async function getViewer(): Promise<{ email: string | null; signedIn: boolean; tier: Tier }> {
  try {
    const { data: { user } } = await (await supabaseServer()).auth.getUser();
    return { email: user?.email ?? null, signedIn: Boolean(user), tier: user ? await currentTier() : "free" };
  } catch { return { email: null, signedIn: false, tier: "free" }; }
}
