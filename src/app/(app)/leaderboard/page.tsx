import Link from "next/link";
import { getLeaderboard, getMe } from "@/lib/community/server";
import { settleSoon } from "@/lib/community/settle";
export const dynamic = "force-dynamic";
export default async function Leaderboard({ searchParams }: { searchParams: Promise<{ range?: string }> }) {
  const kind = (await searchParams).range === "all" ? "all" : "week"; await settleSoon(); const [rows, me] = await Promise.all([getLeaderboard(kind, 100), getMe()]);
  return (<>
    <div className="row"><div><h1>Leaderboard</h1><p className="sub">Points reward calibration, not just being right. 0 equals guessing, a confident right call scores best and a confident wrong call costs most. You appear after three settled picks.</p></div></div>
    <div className="tabs"><Link className={`tab ${kind === "week" ? "on" : ""}`} href="/leaderboard">This week</Link><Link className={`tab ${kind === "all" ? "on" : ""}`} href="/leaderboard?range=all">All time</Link></div>
    {!rows.length ? <div className="card"><p className="note">Nobody has three settled picks yet. <Link href="/community" style={{ color: "#00e676" }}>Make a prediction</Link>.</p></div>
      : <div className="card scroll"><table><thead><tr><th>#</th><th>PLAYER</th><th>POINTS</th><th>PICKS</th><th>RIGHT</th></tr></thead><tbody>{rows.map((r, i) => <tr key={r.username} style={r.username === me.username ? { background: "rgba(0,230,118,.08)" } : undefined}><td className="n">{i + 1}</td><td>@{r.username}</td><td className="n"><b>{r.points}</b></td><td className="n">{r.picks}</td><td className="n">{r.accuracy}%</td></tr>)}</tbody></table></div>}
  </>);
}
