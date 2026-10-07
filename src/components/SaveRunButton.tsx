"use client";
import { useState } from "react";
export function SaveRunButton({ game, source, range, window, threshold }: { game: string; source: string; range: string; window: number; threshold: number }) {
  const [msg, setMsg] = useState<string | null>(null), [busy, setBusy] = useState(false);
  async function save() { setBusy(true); const r = await fetch("/api/lab/runs", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ game, source, range, window, threshold }) }), j = await r.json().catch(() => ({})); setMsg(r.ok ? "Run saved." : j.error ?? j.message ?? "Could not save."); setBusy(false); }
  return <span style={{ display: "inline-flex", gap: 8, alignItems: "center" }}><button className="btn sm" type="button" disabled={busy} onClick={() => void save()}>Save this run</button>{msg && <span className="note" role="status">{msg}</span>}</span>;
}
