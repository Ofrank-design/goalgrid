import Link from "next/link";
import { notFound } from "next/navigation";
import { ModerateButtons } from "@/components/AdminActions";
import { getAdmin } from "@/lib/ops/admin";
import { supabaseAdmin } from "@/lib/supabase/admin";
export const dynamic = "force-dynamic";
export default async function Moderation() {
  if (!(await getAdmin())) notFound();
  const db = supabaseAdmin(), { data: reps } = await db.from("post_reports").select("post_id,reason"), ids = [...new Set((reps ?? []).map(r => r.post_id as string))];
  const [hidden, flagged] = await Promise.all([db.from("posts").select("id,body,status,created_at,user_id,match_id").eq("status", "hidden").order("created_at", { ascending: false }).limit(50), ids.length ? db.from("posts").select("id,body,status,created_at,user_id,match_id").in("id", ids).eq("status", "visible") : Promise.resolve({ data: [] as never[] })]);
  const posts = [...(hidden.data ?? []), ...(flagged.data ?? [])] as { id: string; body: string; status: string; created_at: string; user_id: string; match_id: string | null }[];
  const { data: profs } = posts.length ? await db.from("profiles").select("id,username").in("id", [...new Set(posts.map(p => p.user_id))]) : { data: [] as { id: string; username: string | null }[] };
  const name = new Map((profs ?? []).map(p => [p.id as string, p.username as string | null]));
  return (<>
    <p className="note"><Link href="/admin" style={{ color: "#00e676" }}>Back to operations</Link></p>
    <div className="row" style={{ marginTop: 10 }}><div><h1>Moderation</h1><p className="sub">Posts hidden by reports, and visible posts that have been reported. Every action is logged.</p></div></div>
    {!posts.length && <div className="card"><p className="note">Nothing to review.</p></div>}
    <div style={{ display: "grid", gap: 12 }}>{posts.map(p => { const mine = (reps ?? []).filter(r => r.post_id === p.id); return (
      <div key={p.id} className="card"><div className="lh"><b style={{ color: "#fbfafc" }}>@{name.get(p.user_id) ?? "unknown"}</b><span>{p.status}</span><span>{mine.length} report{mine.length === 1 ? "" : "s"}</span>{p.match_id && <span>{p.match_id}</span>}</div>
        <p style={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>{p.body}</p>{mine.some(r => r.reason) && <p className="note" style={{ marginTop: 6 }}>Reasons: {mine.map(r => r.reason).filter(Boolean).join("; ")}</p>}
        <div style={{ marginTop: 10 }}><ModerateButtons postId={p.id} canRestore /></div></div>); })}</div>
  </>);
}
