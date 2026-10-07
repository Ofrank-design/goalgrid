import Link from "next/link";
import { LeagueBadge } from "@/components/LeagueBadge";
import { CLUBS, LEAGUES } from "@/lib/football/clubs";
export const metadata = { title: "Leagues | GoalGrid" };
export default function Leagues() {
  return (<>
    <h1>Leagues</h1><p className="sub">The five leagues GoalGrid covers, with live standings and the next fixtures.</p>
    <div className="grid" style={{ marginTop: 22 }}>{LEAGUES.map(l => <Link key={l.slug} href={`/leagues/${l.slug}`} className="card link" style={{ display: "flex", gap: 14, alignItems: "center" }}><LeagueBadge slug={l.slug} size={56} /><div><b style={{ fontSize: 17 }}>{l.name}</b><div className="note">{l.country}, {CLUBS.filter(c => c.league === l.slug).length} clubs</div></div></Link>)}</div>
  </>);
}
