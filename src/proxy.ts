import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { SlidingWindow, limitFor } from "@/lib/security/ratelimit";
import { MAX_BODY_BYTES, sameOrigin } from "@/lib/security/origin";
import { clientIp } from "@/lib/security/ip";
/** Pages that need a signed in user, and the staff area. Middleware only sends visitors to sign in; every page and action still checks the user and role on the server. */
export const needsSignIn = (path: string) => /^\/(settings|notifications|my-predictions|my-bookings|admin|moderator)(\/|$)/.test(path) || /^\/profile\/edit$/.test(path) || /^\/community\/(create|bookings\/create|bookings\/[^/]+\/edit)$/.test(path);
const window_ = new SlidingWindow(), deny = (status: number, error: string, extra?: Record<string, string>) => NextResponse.json({ error }, { status, headers: extra });
/** API guard first (origin, body size, rate limit), then the Supabase session refresh. Cron and readiness routes carry their own bearer token. */
export async function proxy(req: NextRequest) {
  const path = req.nextUrl.pathname;
  if (path.startsWith("/api") && !path.startsWith("/api/cron") && path !== "/api/health/ready") {
    if (req.method !== "GET" && req.method !== "HEAD") {
      if (!sameOrigin(req.headers.get("origin"), req.headers.get("host"))) return deny(403, "Cross-site request blocked.");
      if (Number(req.headers.get("content-length") ?? 0) > MAX_BODY_BYTES) return deny(413, "Request too large.");
    }
    const lim = limitFor(path); if (lim) { const ip = clientIp(req.headers), r = window_.check(`${ip}|${lim[0]}`, lim[1], lim[2]); if (!r.ok) return deny(429, "Too many requests. Please slow down.", { "Retry-After": String(r.retryAfterSec) }); }
  }
  let res = NextResponse.next({ request: req });
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL, key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key || path.startsWith("/api/cron")) return res;
  const sb = createServerClient(url, key, { cookies: { getAll: () => req.cookies.getAll(), setAll: (l: { name: string; value: string; options: CookieOptions }[]) => { l.forEach(c => req.cookies.set(c.name, c.value)); res = NextResponse.next({ request: req }); l.forEach(c => res.cookies.set(c.name, c.value, c.options)); } } });
  const { data: { user } } = await sb.auth.getUser();
  if (!user && needsSignIn(path)) { const to = req.nextUrl.clone(); to.pathname = "/sign-in"; to.search = `?next=${encodeURIComponent(path + req.nextUrl.search)}`; return NextResponse.redirect(to); }
  return res;
}
export const config = { matcher: ["/((?!_next/static|_next/image|favicon.ico|icon-|apple-touch-icon|home/|site/|brand/).*)"] };
