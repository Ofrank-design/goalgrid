"use client";
import { useState } from "react";
import Link from "next/link";
import { checkContact, TOPICS, type Topic } from "@/lib/site/contact";
export function ContactForm() {
  const [v, setV] = useState({ name: "", email: "", topic: "general" as Topic, message: "", website: "" }); const [msg, setMsg] = useState<{ ok: boolean; t: string } | null>(null); const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof v) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => setV({ ...v, [k]: e.target.value });
  async function submit(e: React.FormEvent) {
    e.preventDefault(); const c = checkContact(v); if (!c.ok) { setMsg({ ok: false, t: c.error }); return; }
    setBusy(true); setMsg(null);
    try { const r = await fetch("/api/contact", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(v) }), j = await r.json().catch(() => ({}));
      if (r.ok) { setMsg({ ok: true, t: "Thanks, your message is on its way. We usually reply within a few working days." }); setV({ ...v, message: "", website: "" }); } else setMsg({ ok: false, t: j.error ?? "Could not send your message." }); }
    catch { setMsg({ ok: false, t: "Network error. Please try again." }); } finally { setBusy(false); }
  }
  return (
    <form className="si-card si-form" onSubmit={submit} noValidate>
      <div className="si-row2">
        <div className="si-f"><label htmlFor="c-name">Name</label><input id="c-name" className="si-in" autoComplete="name" maxLength={80} value={v.name} onChange={set("name")} placeholder="Your name" /></div>
        <div className="si-f"><label htmlFor="c-email">Email</label><input id="c-email" className="si-in" type="email" autoComplete="email" value={v.email} onChange={set("email")} placeholder="you@example.com" /></div>
      </div>
      <div className="si-f"><label htmlFor="c-topic">Topic</label><select id="c-topic" className="si-in" value={v.topic} onChange={set("topic")}>{Object.entries(TOPICS).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></div>
      <div className="si-f"><label htmlFor="c-msg">Message</label><textarea id="c-msg" className="si-in" maxLength={2000} value={v.message} onChange={set("message")} placeholder="How can we help?" /></div>
      <div className="si-hp" aria-hidden="true"><label htmlFor="c-web">Website</label><input id="c-web" tabIndex={-1} autoComplete="off" value={v.website} onChange={set("website")} /></div>
      <div><button className="si-b p" type="submit" disabled={busy}>{busy ? "Sending" : "Send message"}</button></div>
      <div className="si-msg" role="status" style={{ color: msg?.ok ? "#00e676" : "#ff5d5d" }}>{msg?.t}</div>
      <p className="si-fine">By sending this you agree to our <Link href="/privacy">privacy policy</Link>. We use your details only to reply to you.</p>
    </form>
  );
}
