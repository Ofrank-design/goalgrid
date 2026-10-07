import { NextResponse } from "next/server";
import { z } from "zod";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { emailConfigured, sendEmail } from "@/lib/providers/resend";
import { emailSecret, siteUrl } from "@/lib/ops/admin";
import { signToken } from "@/lib/ops/tokens";
import { esc } from "@/lib/ops/digest";
import { allowIp, allowTarget, tooMany } from "@/lib/security/limits";
/** Double opt in: nothing is sent to an address until its owner clicks the confirmation link. The answer is the same whether or not the address was already known. */
export async function POST(req: Request) {
  const rl = await allowIp(req, "subscribe", 5, 3600); if (!rl.ok) return tooMany("Too many attempts. Try again later.", rl.retryAfterSec);
  const p = z.object({ email: z.string().email().max(200) }).safeParse(await req.json().catch(() => null)); if (!p.success) return NextResponse.json({ error: "Enter a valid email." }, { status: 400 });
  if (!emailConfigured() || !emailSecret()) return NextResponse.json({ error: "Email signup is not available yet." }, { status: 503 });
  const email = p.data.email.toLowerCase();
  const perAddress = await allowTarget("subscribe", email, 3, 86_400); if (!perAddress.ok) return NextResponse.json({ ok: true });
  const db = supabaseAdmin(), { data: row } = await db.from("email_subscribers").select("confirmed_at,unsubscribed_at").eq("email", email).maybeSingle();
  if (row?.confirmed_at && !row.unsubscribed_at) return NextResponse.json({ ok: true });
  await db.from("email_subscribers").upsert({ email, unsubscribed_at: null }, { onConflict: "email" });
  const link = `${siteUrl(req)}/api/email/confirm?t=${signToken("confirm", email, emailSecret(), 3 * 86_400_000)}`;
  try { await sendEmail({ to: email, subject: "Confirm your GoalGrid emails", html: `<p style="font-family:Arial,sans-serif">Tap to confirm you want GoalGrid match day emails:</p><p><a href="${esc(link)}">Confirm my email</a></p><p style="font-family:Arial,sans-serif;font-size:12px;color:#5b6b78">If this wasn't you, ignore this message and nothing will be sent.</p>`, text: `Confirm your GoalGrid match day emails: ${link}\n\nIf this wasn't you, ignore this message.` }); await db.from("email_log").insert({ kind: "confirm", recipient: email, status: "sent" }); }
  catch (e) { await db.from("email_log").insert({ kind: "confirm", recipient: email, status: "failed", error: (e as Error).message.slice(0, 200) }); return NextResponse.json({ error: "Could not send the confirmation email." }, { status: 502 }); }
  return NextResponse.json({ ok: true });
}
