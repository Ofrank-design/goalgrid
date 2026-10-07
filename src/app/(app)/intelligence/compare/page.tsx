import Link from "next/link";
import { Gate } from "@/components/Gate";
import { getViewer } from "@/lib/app/session";
import { hasTier } from "@/lib/entitlements";
import { RANGES, listGames, loadSeries, type Range } from "@/lib/lab/data";
import { compare, INSUFFICIENT } from "@/lib/lab/stats";
export const dynamic = "force-dynamic";
type Sp = { a?: string; b?: string; range?: string };
const n = (x: unknown, d = 2) => (typeof x === "number" ? x.toFixed(d) : "n/a"), p3 = (x: number) => (x < 0.001 ? "< 0.001" : x.toFixed(3));
export default async function Compare({ searchParams }: { searchParams: Promise<Sp> }) {
  const v = await getViewer(); if (!hasTier(v.tier, "premium")) return <Gate need="premium" signedIn={v.signedIn} title="Comparison Lab" blurb="Compare two sources or two games side by side with distribution tests." />;
  const sp = await searchParams; let games: Awaited<ReturnType<typeof listGames>> = []; try { games = await listGames(); } catch { /* handled below */ }
  const opts = games.flatMap(g => g.sources.map(s => ({ key: `${g.id}|${s.id}`, label: `${g.name} · ${s.name}` })));
  const head = <div className="row"><div><h1>Comparison Lab</h1><p className="sub">Compare two stored series. A difference describes these samples only.</p></div><Link className="btn sm" href="/intelligence">Back</Link></div>;
  if (opts.length < 2) return <>{head}<div className="card"><b>No data available</b><p className="note">Comparison needs at least two series with stored observations.</p></div></>;
  const range = (Object.keys(RANGES).includes(sp.range ?? "") ? sp.range : "7D") as Range, A = opts.find(o => o.key === sp.a) ?? opts[0], B = opts.find(o => o.key === sp.b) ?? opts[1];
  const sel = <form className="card" method="get" style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "end" }}><label>Series A<select name="a" defaultValue={A.key}>{opts.map(o => <option key={o.key} value={o.key}>{o.label}</option>)}</select></label><label>Series B<select name="b" defaultValue={B.key}>{opts.map(o => <option key={o.key} value={o.key}>{o.label}</option>)}</select></label><label>Range<select name="range" defaultValue={range}>{Object.keys(RANGES).map(r => <option key={r}>{r}</option>)}</select></label><button className="btn p" type="submit">Compare</button></form>;
  if (A.key === B.key) return <>{head}{sel}<p className="note">Choose two different series.</p></>;
  const [ga, sa] = A.key.split("|"), [gb, sb] = B.key.split("|"); let r: ReturnType<typeof compare> | null = null; try { const [x, y] = await Promise.all([loadSeries(ga, sa, range), loadSeries(gb, sb, range)]); r = compare(x.values, y.values); } catch { return <>{head}{sel}<div className="err">Could not read observations right now.</div></>; }
  if (r.status !== "ok") return <>{head}{sel}<p className="note">{INSUFFICIENT}</p></>;
  const rows = [["Observations", r.a.status === "ok" ? r.a.count : "-", r.b.status === "ok" ? r.b.count : "-"], ["Mean", n(r.a.status === "ok" && r.a.mean), n(r.b.status === "ok" && r.b.mean)], ["Median", n(r.a.status === "ok" && r.a.median), n(r.b.status === "ok" && r.b.median)], ["Std deviation", n(r.a.status === "ok" && r.a.sd), n(r.b.status === "ok" && r.b.sd)], ["P95", n(r.a.status === "ok" && r.a.p95), n(r.b.status === "ok" && r.b.p95)]];
  return (<>{head}{sel}<div className="card scroll"><table><thead><tr><th></th><th>A</th><th>B</th></tr></thead><tbody>{rows.map(([k, a, b]) => <tr key={String(k)}><td>{k}</td><td className="n">{a}</td><td className="n">{b}</td></tr>)}</tbody></table>
    <div className="meta" style={{ marginTop: 10 }}>{r.ks.status === "ok" && <span>Distribution difference (KS): D {n(r.ks.d, 3)}, p {p3(r.ks.p)}</span>}<span>Rank difference (Mann-Whitney): z {n(r.mannWhitney.z)}, p {p3(r.mannWhitney.p)}</span></div>
    <p className="note">A small p means the two samples look different. It does not show that either source is wrong, and it does not make any outcome predictable.</p></div></>);
}
