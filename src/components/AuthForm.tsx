"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createBrowserClient } from "@supabase/ssr";
export function AuthForm({ next, signup }: { next: string; signup: boolean }) {
  const router = useRouter(); const [mode, setMode] = useState<"in" | "up">(signup ? "up" : "in");
  const [email, setEmail] = useState(""); const [password, setPassword] = useState(""); const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null); const [busy, setBusy] = useState(false);
  async function submit() {
    setBusy(true); setMsg(null);
    const sb = createBrowserClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
    try {
      if (mode === "in") {
        const { error } = await sb.auth.signInWithPassword({ email, password });
        if (error) setMsg({ ok: false, text: "Email or password not recognised." }); else { router.push(next); router.refresh(); }
      } else {
        const { data, error } = await sb.auth.signUp({ email, password, options: { emailRedirectTo: `${location.origin}/auth/callback?next=${encodeURIComponent(next)}` } });
        if (error) setMsg({ ok: false, text: error.message }); else if (data.session) { router.push(next); router.refresh(); } else setMsg({ ok: true, text: "Check your email to confirm your account." });
      }
    } catch { setMsg({ ok: false, text: "Something went wrong. Try again." }); } finally { setBusy(false); }
  }
  return (
    <div className="form">
      <input className="in" type="email" autoComplete="email" aria-label="Email" placeholder="Email" value={email} onChange={e => setEmail(e.target.value)} />
      <input className="in" type="password" autoComplete={mode === "in" ? "current-password" : "new-password"} aria-label="Password" placeholder="Password (8 characters or more)" value={password} onChange={e => setPassword(e.target.value)} onKeyDown={e => { if (e.key === "Enter") void submit(); }} />
      <button className="btn p" type="button" disabled={busy || !email || password.length < 8} onClick={() => void submit()}>{mode === "in" ? "Sign in" : "Create account"}</button>
      <button className="btn sm" type="button" onClick={() => setMode(mode === "in" ? "up" : "in")}>{mode === "in" ? "New here? Create an account" : "Have an account? Sign in"}</button>
      <div className="msg" role="status" style={{ color: msg?.ok ? "#00e676" : "#ff5d5d" }}>{msg?.text}</div>
    </div>
  );
}
