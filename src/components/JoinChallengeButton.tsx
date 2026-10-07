"use client";
import { useState } from "react";
export function JoinChallengeButton({ challengeId }: { challengeId: string }) {
  const [busy, setBusy] = useState(false), [msg, setMsg] = useState<string | null>(null);
  async function join() { setBusy(true); setMsg(null); try { const r = await fetch(`/api/challenges/${challengeId}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "join" }) }); const j = await r.json().catch(() => ({})); if (!r.ok) throw new Error(j.error ?? "Could not join challenge."); setMsg("Joined. Refresh the page to make your picks."); } catch (e) { setMsg((e as Error).message); } finally { setBusy(false); } }
  return <div><button className="btn p sm" type="button" disabled={busy} onClick={() => void join()}>{busy ? "Joining…" : "Join challenge"}</button>{msg && <p className="note" role="status" style={{ marginTop: 8 }}>{msg}</p>}</div>;
}
