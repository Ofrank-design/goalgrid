import "server-only";
import { createClient } from "@supabase/supabase-js";
import { env } from "@/lib/env";
/** Service role bypasses RLS. Server-only: entitlements, provider health, logs. Never import from client code. */
export const supabaseAdmin = () => createClient(env().NEXT_PUBLIC_SUPABASE_URL, env().SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
