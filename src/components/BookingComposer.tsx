"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { BOOKING_NOTICE } from "@/lib/community/booking";
export function BookingComposer() {
  const router = useRouter(); const [f, setF] = useState({ bookingCode: "", bookmaker: "", odds: "", note: "", visibility: "public" }); const [file, setFile] = useState<File | null>(null); const [msg, setMsg] = useState<string | null>(null); const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => setF(s => ({ ...s, [k]: e.target.value }));
  async function send() {
    setBusy(true); setMsg(null);
    try {
      const r = await fetch("/api/community/bookings", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ bookingCode: f.bookingCode, ...(f.bookmaker ? { bookmaker: f.bookmaker } : {}), ...(f.odds ? { odds: Number(f.odds) } : {}), ...(f.note ? { note: f.note } : {}), visibility: f.visibility }) }), j = await r.json().catch(() => ({}));
      if (!r.ok) { setMsg(j.error ?? "Could not share."); return; }
      if (file) { const fd = new FormData(); fd.append("file", file); const u = await fetch(`/api/community/bookings/${j.id}/proof`, { method: "POST", body: fd }); if (!u.ok) setMsg((await u.json().catch(() => ({}))).error ?? "Shared, but the image was not saved."); }
      setF({ bookingCode: "", bookmaker: "", odds: "", note: "", visibility: "public" }); setFile(null); router.refresh();
    } catch { setMsg("Network error. Try again."); } finally { setBusy(false); }
  }
  return (<div style={{ display: "grid", gap: 8 }}>
    <p className="note">{BOOKING_NOTICE}</p>
    <input className="in" placeholder="Booking code" maxLength={100} value={f.bookingCode} onChange={set("bookingCode")} aria-label="Booking code" />
    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}><input className="in" placeholder="Bookmaker (optional)" maxLength={40} value={f.bookmaker} onChange={set("bookmaker")} aria-label="Bookmaker" /><input className="in" placeholder="Odds (optional)" inputMode="decimal" value={f.odds} onChange={set("odds")} aria-label="Odds" />
      <select className="in" value={f.visibility} onChange={set("visibility")} aria-label="Who can see this"><option value="public">Public</option><option value="followers">Followers</option><option value="private">Only me</option></select></div>
    <textarea className="in" rows={2} maxLength={300} placeholder="Add a note (optional)" value={f.note} onChange={set("note")} aria-label="Note" />
    <label className="note">Proof image (optional, JPG, PNG or WebP, 1 MB). An image does not verify a share.<input type="file" accept="image/jpeg,image/png,image/webp" onChange={e => setFile(e.target.files?.[0] ?? null)} /></label>
    <div><button className="btn p" type="button" disabled={busy || f.bookingCode.trim().length < 3} onClick={() => void send()}>{busy ? "Sharing..." : "Share code"}</button></div>{msg && <p className="note" role="alert">{msg}</p>}</div>);
}
