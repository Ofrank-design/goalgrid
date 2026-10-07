import "server-only";
import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { cookies } from "next/headers";
import { env } from "@/lib/env";
/** Per-request client acting as the signed-in user, so Row Level Security applies. */
export async function supabaseServer() {
  const jar = await cookies(), e = env();
  return createServerClient(e.NEXT_PUBLIC_SUPABASE_URL, e.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
    cookies: { getAll: () => jar.getAll(), setAll: (l: { name: string; value: string; options: CookieOptions }[]) => { try { l.forEach(c => jar.set(c.name, c.value, c.options)); } catch {} } },
  });
}
