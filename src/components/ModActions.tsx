"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
export function ModActions({ type, id, actions, admin }: { type: "booking" | "post" | "user"; id: string; actions: string[]; admin: boolean }) {
  const router = useRouter(), [reason, setReason] = useState(""), [days, setDays] = useState(1), [msg, setMsg] = useState<string | null>(null);
  async function go(action: string) { const r = await fetch("/api/moderation", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ type, id, action, reason, ...(action === "suspend" ? { days } : {}) }) }), j = await r.json().catch(() => ({})); if (r.ok) { setMsg(`Done: ${j.state}`); router.refresh(); } else setMsg(j.error ?? "Could not do that."); }
  return (<div style={{ display: "grid", gap: 6, marginTop: 8 }}><input className="in" placeholder="Reason (required, saved in the audit log)" value={reason} onChange={e => setReason(e.target.value)} aria-label="Reason" maxLength={300} />
    <div className="chips" style={{ alignItems: "center" }}>{actions.map(a => <button key={a} className="chip" type="button" onClick={() => void go(a)}>{a}</button>)}{actions.includes("suspend") && <input className="in" type="number" min={1} max={admin ? 365 : 7} value={days} onChange={e => setDays(Number(e.target.value))} style={{ width: 70 }} aria-label="Days" />}{msg && <span className="note">{msg}</span>}</div></div>);
}
