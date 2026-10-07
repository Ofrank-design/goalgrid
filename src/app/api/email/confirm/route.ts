import { supabaseAdmin } from "@/lib/supabase/admin";
import { emailSecret } from "@/lib/ops/admin";
import { verifyToken } from "@/lib/ops/tokens";
const page = (title: string, body: string, status = 200) => new Response(`<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><body style="font-family:Arial,sans-serif;background:#0b1420;color:#fbfafc;display:grid;place-items:center;min-height:100vh;margin:0"><div style="max-width:420px;padding:24px;text-align:center"><h1>${title}</h1><p style="color:#9fb2b8">${body}</p><p><a style="color:#00e676" href="/">Back to GoalGrid</a></p></div></body>`, { status, headers: { "Content-Type": "text/html; charset=utf-8" } });
const tokenOf = (req: Request) => new URL(req.url).searchParams.get("t") ?? "";
/** Opening the link only shows a button. The POST that follows does the confirming, so email scanners that pre-open links cannot confirm for you. */
export async function GET(req: Request) {
  const t = tokenOf(req); if (!verifyToken(t, "confirm", emailSecret())) return page("Link expired", "This confirmation link is invalid or has expired. Sign up again from the footer.", 400);
  return page("Confirm your email", `<form method="post" action="/api/email/confirm?t=${encodeURIComponent(t)}"><button style="background:#00e676;border:0;border-radius:12px;padding:13px 22px;font-weight:700;font-size:15px;cursor:pointer">Yes, send me match day emails</button></form>`);
}
export async function POST(req: Request) {
  const email = verifyToken(tokenOf(req), "confirm", emailSecret()); if (!email) return page("Link expired", "This confirmation link is invalid or has expired. Sign up again from the footer.", 400);
  await supabaseAdmin().from("email_subscribers").update({ confirmed_at: new Date().toISOString(), unsubscribed_at: null }).eq("email", email);
  return page("You're in", "Thanks. You'll get match day emails with the day's top predictions.");
}
