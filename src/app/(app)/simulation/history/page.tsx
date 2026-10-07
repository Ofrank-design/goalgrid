import Link from "next/link";
import { Gate } from "@/components/Gate";
import { requireUser } from "@/lib/community/api";
import { getViewer } from "@/lib/app/session";
import { hasTier } from "@/lib/entitlements";
import { supabaseAdmin } from "@/lib/supabase/admin";
export const dynamic = "force-dynamic";
const nice = (s: string) => s.split("-").map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
export default async function History() {
  const v = await getViewer(), u = await requireUser(); if (!u || !hasTier(v.tier, "pro")) return <Gate need="pro" signedIn={v.signedIn} title="Simulation history" blurb="Every simulation you run is kept with its seed and engine version." />;
  const { data } = await supabaseAdmin().from("simulation_runs").select("id,kind,league_slug,configuration,seed,engine_version,record_count,result,created_at").eq("user_id", u.id).order("created_at", { ascending: false }).limit(50);
  const what = (r: { kind: string; configuration: Record<string, unknown>; result: Record<string, unknown> }) => r.kind === "match" ? `${nice(String(r.configuration.home))} ${(r.result.final as { home: number; away: number }).home}–${(r.result.final as { home: number; away: number }).away} ${nice(String(r.configuration.away))}` : r.kind === "multi" ? `${nice(String(r.configuration.home))} vs ${nice(String(r.configuration.away))}, ${Number(r.configuration.runs).toLocaleString("en")} runs` : r.kind === "experiment" ? `${String(r.configuration.name ?? "Experiment")} · ${Number(r.configuration.runs ?? 0).toLocaleString("en")} runs` : `${Number(r.configuration.seasons).toLocaleString("en")} seasons`;
  return (<><div className="row"><div><h1>Simulation history</h1><p className="sub">Hypothetical results only. Each run is stored as it was produced, with its seed.</p></div><Link className="btn sm" href="/simulation">Back</Link></div>
    {!data?.length ? <div className="card"><p className="note">No simulations yet.</p></div> : <div className="card scroll"><table><thead><tr><th>WHEN</th><th>TYPE</th><th>LEAGUE</th><th>RESULT</th><th>SEED</th><th>ENGINE</th><th></th></tr></thead><tbody>{data.map(r => <tr key={r.id as string}><td>{new Date(r.created_at as string).toUTCString().slice(5, 22)}</td><td>{r.kind as string}</td><td>{nice(r.league_slug as string)}</td><td>{what(r as never)}</td><td className="n">{r.seed as string}</td><td>{r.engine_version as string}</td><td>{r.kind === "match" ? <Link href={`/simulation?replay=${r.id as string}`}>Replay</Link> : r.kind === "experiment" ? <Link href={`/simulation/experiments?replay=${r.id as string}`}>Open</Link> : null}</td></tr>)}</tbody></table></div>}
    <p className="note">SIMULATION · SYNTHETIC DATA · NOT A LIVE MATCH PREDICTION · NOT VERIFIED PERFORMANCE</p></>);
}
