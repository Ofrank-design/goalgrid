import { notFound } from "next/navigation";
import { ModActions } from "@/components/ModActions";
import { UserAction } from "@/components/UserAction";
import { getStaff } from "@/lib/community/staff";
import { supabaseAdmin } from "@/lib/supabase/admin";
export const dynamic = "force-dynamic";
export default async function Moderator() {
  const staff = await getStaff(); if (!staff) notFound(); const db = supabaseAdmin(), admin = staff.role === "admin";
  const [{ data: bookings }, { data: posts }, { data: logs }] = await Promise.all([
    db.from("community_booking_posts").select("id,booking_code,bookmaker,note,verification_status,moderation_status,created_at,profiles(username)").or("moderation_status.eq.under_review,verification_status.eq.pending_review,verification_status.eq.unverified").order("created_at", { ascending: false }).limit(25),
    db.from("posts").select("id,body,status,profiles(username)").neq("status", "removed").order("created_at", { ascending: false }).limit(15), db.from("moderation_actions").select("id,action,target_type,target_id,prior_state,new_state,reason,created_at").order("id", { ascending: false }).limit(15)]);
  const name = (r: unknown) => (r as { profiles?: { username?: string } }).profiles?.username ?? "unknown";
  return (<>
    <div className="row"><div><h1>Moderation</h1><p className="sub">Signed in as {staff.role}. Every action needs a reason and is written to a log nobody can edit.</p></div></div>
    <h2>Booking shares</h2><div style={{ display: "grid", gap: 10 }}>{(bookings ?? []).map(b => <div key={b.id as string} className="card"><b style={{ fontFamily: "monospace" }}>{b.booking_code as string}</b> <span className="note">by @{name(b)} · {b.verification_status as string} · {b.moderation_status as string}</span>{b.note && <p>{b.note as string}</p>}
      <ModActions type="booking" id={b.id as string} actions={["review", "verify", "reject", "hide", "remove", "restore"]} admin={admin} /></div>)}{!bookings?.length && <div className="card"><p className="note">Nothing to review.</p></div>}</div>
    <h2>Recent posts</h2><div style={{ display: "grid", gap: 10 }}>{(posts ?? []).map(p => <div key={p.id as string} className="card"><span className="note">@{name(p)} · {p.status as string}</span><p>{p.body as string}</p><ModActions type="post" id={p.id as string} actions={["hide", "remove", "restore"]} admin={admin} /></div>)}</div>
    <h2>Account action</h2><UserAction admin={admin} />
    <h2>Audit log</h2><div className="card scroll"><table><thead><tr><th>#</th><th>ACTION</th><th>TARGET</th><th>FROM → TO</th><th>REASON</th></tr></thead><tbody>{(logs ?? []).map(l => <tr key={l.id as number}><td className="n">{l.id as number}</td><td>{l.action as string}</td><td>{l.target_type as string} {String(l.target_id ?? "").slice(0, 12)}</td><td>{(l.prior_state as string) ?? "-"} → {(l.new_state as string) ?? "-"}</td><td>{(l.reason as string) ?? ""}</td></tr>)}</tbody></table></div></>);
}
