import "server-only";
import { supabaseServer } from "@/lib/supabase/server";
export type Tier = "free" | "pro" | "premium";
const rank: Record<Tier, number> = { free: 0, pro: 1, premium: 2 };
export const hasTier = (have: Tier, need: Tier) => rank[have] >= rank[need];
/**
 * Everything is free: every signed-in user has full access, with no codes and no payments. Anonymous visitors are "free" only because the tools that need
 * an account (saved runs, limits, concurrency slots) have no one to attach to; signing up is free. Existing user_entitlements rows are no longer read.
 * The Tier type and hasTier stay so every gate in the app goes through this one function; if plans ever return, change it here and in public.is_pro()/is_premium().
 */
export async function currentTier(): Promise<Tier> {
  const { data: { user } } = await (await supabaseServer()).auth.getUser();
  return user ? "premium" : "free";
}
