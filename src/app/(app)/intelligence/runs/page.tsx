import Link from "next/link";
import { Gate } from "@/components/Gate";
import { requireUser } from "@/lib/community/api";
import { getViewer } from "@/lib/app/session";
import { hasTier } from "@/lib/entitlements";
import { supabaseAdmin } from "@/lib/supabase/admin";
export const dynamic = "force-dynamic";
export default async function Runs() {
  const v = await getViewer(), u = await requireUser(); if (!u || !hasTier(v.tier, "premium")) return <Gate need="premium" signedIn={v.signedIn} title="Saved runs" blurb="Keep the analyses you run, with the engine version that produced them." />;
  const { data } = await supabaseAdmin().from("analysis_runs").select("id,game_id,source_id,params,engine_version,observation_count,created_at").eq("user_id", u.id).order("created_at", { ascending: false }).limit(50);
  return (<><div className="row"><div><h1>Saved runs</h1><p className="sub">Each run keeps the result as it was computed, with the engine version. Older runs are never recalculated.</p></div><Link className="btn sm" href="/intelligence">Back</Link></div>
    {!data?.length ? <div className="card"><p className="note">No saved runs yet. Use “Save this run” on the Lab page.</p></div> : <div className="card scroll"><table><thead><tr><th>WHEN</th><th>GAME</th><th>SOURCE</th><th>RANGE</th><th>OBSERVATIONS</th><th>ENGINE</th></tr></thead><tbody>{data.map(r => <tr key={r.id as string}><td>{new Date(r.created_at as string).toUTCString().slice(5, 22)}</td><td>{r.game_id as string}</td><td>{r.source_id as string}</td><td>{String((r.params as { range?: string }).range ?? "")}</td><td className="n">{r.observation_count as number}</td><td>{r.engine_version as string}</td></tr>)}</tbody></table></div>}</>);
}
