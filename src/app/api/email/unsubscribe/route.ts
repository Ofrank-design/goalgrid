import { supabaseAdmin } from "@/lib/supabase/admin";
import { emailSecret } from "@/lib/ops/admin";
import { verifyToken } from "@/lib/ops/tokens";
const page = (title: string, body: string, status = 200) => new Response(`<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><body style="font-family:Arial,sans-serif;background:#0b1420;color:#fbfafc;display:grid;place-items:center;min-height:100vh;margin:0"><div style="max-width:420px;padding:24px;text-align:center"><h1>${title}</h1><p style="color:#9fb2b8">${body}</p><p><a style="color:#00e676" href="/">Back to GoalGrid</a></p></div></body>`, { status, headers: { "Content-Type": "text/html; charset=utf-8" } });
async function handle(req: Request) {
  const t = new URL(req.url).searchParams.get("t") ?? "", db = supabaseAdmin(), sub = verifyToken(t, "unsub-sub", emailSecret()), user = sub ? null : verifyToken(t, "unsub-user", emailSecret());
  if (sub) await db.from("email_subscribers").update({ unsubscribed_at: new Date().toISOString() }).eq("email", sub);
  else if (user) await db.from("user_preferences").update({ email_updates: false }).eq("user_id", user);
  else return page("Link not valid", "This unsubscribe link is invalid. Use the link in your most recent email.", 400);
  return page("Unsubscribed", "You won't get any more match day emails.");
}
export const GET = handle, POST = handle;
