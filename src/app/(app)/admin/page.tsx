import Link from "next/link";
import { notFound } from "next/navigation";
import { nowMs } from "@/lib/app/format";
import { RunJobs } from "@/components/AdminActions";
import { getAdmin } from "@/lib/ops/admin";
import { supabaseAdmin } from "@/lib/supabase/admin";
export const dynamic = "force-dynamic";
const ago = (iso: string | null) => { if (!iso) return "never"; const m = Math.round((Date.now() - Date.parse(iso)) / 60_000); return m < 1 ? "just now" : m < 60 ? `${m}m ago` : m < 1440 ? `${Math.round(m / 60)}h ago` : `${Math.round(m / 1440)}d ago`; };
export default async function Admin() {
  if (!(await getAdmin())) notFound();
  const db = supabaseAdmin(), day = new Date(nowMs() - 86_400_000).toISOString();
  const [health, jobs, rep, snaps, res, sent, failed] = await Promise.all([
    db.from("provider_health").select("provider,status,latency_ms,last_ok_at,last_error_kind,updated_at").order("provider"), db.from("ingestion_jobs").select("job,status,started_at,finished_at,detail").order("created_at", { ascending: false }).limit(12),
    db.from("post_reports").select("post_id", { count: "exact", head: true }), db.from("prediction_snapshots").select("match_id", { count: "exact", head: true }), db.from("prediction_results").select("match_id", { count: "exact", head: true }),
    db.from("email_log").select("id", { count: "exact", head: true }).eq("status", "sent").gte("created_at", day), db.from("email_log").select("id", { count: "exact", head: true }).eq("status", "failed").gte("created_at", day)]);
  return (<>
    <div className="row"><div><h1>Operations</h1><p className="sub">Provider health, scheduled jobs, moderation and email.</p></div><div className="chips"><Link className="btn sm" href="/admin/moderation">Moderation ({rep.count ?? 0} reports)</Link><Link className="btn sm" href="/accuracy">Accuracy</Link><Link className="btn sm" href="/admin/control-plane">Control Plane</Link><Link className="btn sm" href="/admin/backtests">Backtests</Link></div></div>
    <h2>Run a job now</h2><RunJobs />
    <h2>Providers</h2><div className="card scroll"><table><thead><tr><th>PROVIDER</th><th>STATUS</th><th>LATENCY</th><th>LAST OK</th><th>LAST ERROR</th></tr></thead><tbody>{(health.data ?? []).map(h => <tr key={h.provider as string}><td>{h.provider as string}</td><td style={{ color: h.status === "ok" ? "#00e676" : "#ff5d5d" }}>{h.status as string}</td><td className="n">{h.latency_ms ? `${h.latency_ms} ms` : "n/a"}</td><td>{ago(h.last_ok_at as string | null)}</td><td>{(h.last_error_kind as string | null) ?? "none"}</td></tr>)}{!(health.data ?? []).length && <tr><td colSpan={5} className="note">No provider calls recorded yet.</td></tr>}</tbody></table></div>
    <h2>Scheduled jobs</h2><div className="card scroll"><table><thead><tr><th>JOB</th><th>STATUS</th><th>STARTED</th><th>RESULT</th></tr></thead><tbody>{(jobs.data ?? []).map((j, i) => <tr key={i}><td>{j.job as string}</td><td style={{ color: j.status === "succeeded" ? "#00e676" : j.status === "failed" ? "#ff5d5d" : undefined }}>{j.status as string}</td><td>{ago(j.started_at as string | null)}</td><td className="note">{JSON.stringify(j.detail)}</td></tr>)}{!(jobs.data ?? []).length && <tr><td colSpan={4} className="note">No jobs have run yet.</td></tr>}</tbody></table></div>
    <h2>Numbers</h2><div className="chips"><span className="chip">Stored predictions {snaps.count ?? 0}</span><span className="chip">Evaluated {res.count ?? 0}</span><span className="chip">Emails sent, 24h {sent.count ?? 0}</span><span className="chip">Emails failed, 24h {failed.count ?? 0}</span></div>
  </>);
}
