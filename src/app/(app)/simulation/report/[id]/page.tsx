import Link from "next/link";
import { notFound } from "next/navigation";
import { Gate } from "@/components/Gate";
import { requireUser } from "@/lib/community/api";
import { getViewer } from "@/lib/app/session";
import { hasTier } from "@/lib/entitlements";
import { LABELS, NOTICE } from "@/lib/simulation/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { z } from "zod";
export const dynamic = "force-dynamic";
const nice = (s: string) => s.split("-").map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
export default async function Report({ params }: { params: Promise<{ id: string }> }) {
  const v = await getViewer(), u = await requireUser(); if (!u || !hasTier(v.tier, "premium")) return <Gate need="premium" signedIn={v.signedIn} title="Simulation report" blurb="A printable summary of a stored run with its seed, versions and limitations." />;
  const { id } = await params; if (!z.string().uuid().safeParse(id).success) notFound(); const { data: r } = await supabaseAdmin().from("simulation_runs").select("*").eq("id", id).eq("user_id", u.id).maybeSingle(); if (!r) notFound();
  const cfg = r.configuration as Record<string, unknown>, res = r.result as Record<string, unknown>, fin = res.final as { home: number; away: number } | undefined, sc = res.scenario as { home: number; draw: number; away: number; xgHome: number; xgAway: number } | undefined, applied = (cfg.applied as { label: string; kind: string; mh: number; ma: number }[] | undefined) ?? [];
  return (<><div className="row"><div><h1>Simulation report</h1><p className="sub">Run {String(r.id).slice(0, 8)} · {r.kind} · {nice(r.league_slug as string)}</p></div><Link className="btn sm" href="/simulation/history">History</Link></div>
    <div className="chips">{LABELS.map(l => <span key={l} className="chip" style={{ cursor: "default" }}>{l}</span>)}</div>
    <div className="card"><h2 style={{ marginTop: 0 }}>Run summary</h2><div className="meta"><span>Seed {r.seed as string} (locked)</span><span>Engine {r.engine_version as string}</span><span>Model {r.model_version as string}</span><span>{Number(r.record_count).toLocaleString("en")} {r.kind === "match" ? "match" : "iterations"}</span><span>{new Date(r.created_at as string).toUTCString()}</span></div></div>
    {fin && <div className="card"><h2 style={{ marginTop: 0 }}>Result</h2><b style={{ fontSize: 24 }}>{nice(String(cfg.home))} {fin.home} – {fin.away} {nice(String(cfg.away))}</b>{sc && <p className="note">Model chances for this setup: home {(sc.home * 100).toFixed(0)}%, draw {(sc.draw * 100).toFixed(0)}%, away {(sc.away * 100).toFixed(0)}%. Expected goals {sc.xgHome} – {sc.xgAway}.</p>}</div>}
    {applied.length > 0 && <div className="card"><h2 style={{ marginTop: 0 }}>Assumptions</h2><ul>{applied.map((a, i) => <li key={i}>{a.label}: home attack ×{a.mh}, away attack ×{a.ma} ({a.kind === "derived" ? "computed from the match" : "assumption, not measured"})</li>)}</ul></div>}
    {!fin && <div className="card scroll"><h2 style={{ marginTop: 0 }}>Result data</h2><pre style={{ whiteSpace: "pre-wrap", fontSize: 12 }}>{JSON.stringify(res, null, 2).slice(0, 6000)}</pre></div>}
    <div className="card"><h2 style={{ marginTop: 0 }}>Limitations</h2><ul><li>{NOTICE}</li><li>Shot counts, cards, possession and substitutions are synthetic details generated to fit the simulated score.</li><li>Live chances use the score and time left only.</li><li>Reproducing this run needs the same seed, settings and engine version.</li></ul></div>
    <div className="chips"><a className="chip" href={`/api/simulation/runs/${r.id}/export?format=csv`}>Export CSV</a><a className="chip" href={`/api/simulation/runs/${r.id}/export?format=json`}>Export JSON</a></div></>);
}
