"use client";
import { useState } from "react";
export function NewsletterForm() {
  const [email, setEmail] = useState(""); const [msg, setMsg] = useState<{ ok: boolean; t: string } | null>(null); const [busy, setBusy] = useState(false);
  async function submit(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setMsg(null);
    try { const r = await fetch("/api/email/subscribe", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email }) }), j = await r.json().catch(() => ({})); setMsg(r.ok ? { ok: true, t: "Check your inbox to confirm your email." } : { ok: false, t: j.error ?? "Could not sign you up. Try again." }); if (r.ok) setEmail(""); }
    catch { setMsg({ ok: false, t: "Network error. Try again." }); } finally { setBusy(false); }
  }
  return (<form className="si-nl" onSubmit={submit} style={{ flexWrap: "wrap" }}><input type="email" required placeholder="Your email for match day previews" aria-label="Email" value={email} onChange={e => setEmail(e.target.value)} /><button className="si-b p sm" type="submit" disabled={busy}>Join</button>
    {msg && <div className="si-nlm" role="status" style={{ width: "100%", color: msg.ok ? "#00e676" : "#ff5d5d" }}>{msg.t}</div>}</form>);
}
