"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
export function RunJobs() {
  const [out, setOut] = useState<string | null>(null); const [busy, setBusy] = useState<string | null>(null);
  async function run(job: string) { setBusy(job); setOut(null); try { const r = await fetch("/api/admin/run", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ job }) }); setOut(JSON.stringify(await r.json().catch(() => ({})), null, 1)); } catch { setOut("Network error."); } finally { setBusy(null); } }
  return (<div><div className="chips">{[["refresh", "Refresh predictions"], ["evaluate", "Evaluate results"], ["digest-test", "Send test digest to me"]].map(([k, l]) => <button key={k} className="btn sm" type="button" disabled={busy !== null} onClick={() => void run(k)}>{busy === k ? "Running" : l}</button>)}</div>{out && <pre className="card note" style={{ marginTop: 12, whiteSpace: "pre-wrap" }}>{out}</pre>}<p className="note" style={{ marginTop: 8 }}>Refresh can take up to a minute the first time, while the models are fitted.</p></div>);
}
export function ModerateButtons({ postId, canRestore }: { postId: string; canRestore: boolean }) {
  const router = useRouter(); const [busy, setBusy] = useState(false);
  async function act(action: "restore" | "remove") { setBusy(true); try { await fetch("/api/admin/moderate", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ postId, action }) }); router.refresh(); } finally { setBusy(false); } }
  return (<div className="chips">{canRestore && <button className="btn sm" type="button" disabled={busy} onClick={() => void act("restore")}>Restore</button>}<button className="btn sm" type="button" disabled={busy} onClick={() => void act("remove")}>Remove</button></div>);
}
