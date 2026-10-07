import { NextResponse } from "next/server";
import site from "@/content/site.json";
import { checkContact, TOPICS } from "@/lib/site/contact";
import { emailConfigured, sendEmail } from "@/lib/providers/resend";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { esc } from "@/lib/ops/digest";
import { allowIp, tooMany } from "@/lib/security/limits";
/** Contact form. A hidden field catches simple bots, each address is limited to a few messages an hour, and the message is delivered by email with a reply-to of the sender. */
export async function POST(req: Request) {
  const rl = await allowIp(req, "contact", 5, 3600); if (!rl.ok) return tooMany("Too many messages. Please try again later.", rl.retryAfterSec);
  const c = checkContact(await req.json().catch(() => null)); if (!c.ok) return NextResponse.json({ error: c.error }, { status: 400 });
  if (c.data.website) return NextResponse.json({ ok: true });
  if (!emailConfigured()) return NextResponse.json({ error: `Sending is not available right now. Please email ${site.contactEmail}.` }, { status: 503 });
  const to = process.env.CONTACT_TO ?? (process.env.ADMIN_EMAILS ?? "").split(",")[0]?.trim() ?? "", dest = to || site.contactEmail, { name, email, topic, message } = c.data;
  try {
    await sendEmail({ to: dest, replyTo: email, subject: `[GoalGrid contact] ${TOPICS[topic]}: ${name}`.replace(/[\r\n]+/g, " "),
      html: `<div style="font-family:Arial,sans-serif"><p><b>${esc(name)}</b> &lt;${esc(email)}&gt;<br>${esc(TOPICS[topic])}</p><p style="white-space:pre-wrap">${esc(message)}</p></div>`, text: `${name} <${email}>\n${TOPICS[topic]}\n\n${message}` });
    void supabaseAdmin().from("email_log").insert({ kind: "contact", recipient: dest, status: "sent" });
  } catch (e) { void supabaseAdmin().from("email_log").insert({ kind: "contact", recipient: dest, status: "failed", error: (e as Error).message.slice(0, 200) }); return NextResponse.json({ error: `We could not send your message. Please email ${site.contactEmail}.` }, { status: 502 }); }
  return NextResponse.json({ ok: true });
}
