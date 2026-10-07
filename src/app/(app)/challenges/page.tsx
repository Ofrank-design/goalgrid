import Link from "next/link";
import { currentChallenge, getChallengeLeaderboard } from "@/lib/community/challenges";
import { getMe } from "@/lib/community/server";
export const dynamic = "force-dynamic";
export default async function ChallengesPage() {
  const me = await getMe(), c = await currentChallenge();
  const board = c ? await getChallengeLeaderboard(c.challenge.id, 10) : [];
  return <>
    <div className="row"><div><h1>Challenges</h1><p className="sub">Weekly football prediction competitions scored from your verified GoalGrid picks. Points only; no money or prizes of value.</p></div><Link className="btn sm" href="/leaderboard">Leaderboard</Link></div>
    {!c ? <div className="card" style={{ marginTop: 18 }}><p className="note">No active challenge is available yet. The challenge appears when enough upcoming fixtures are available.</p></div> : <div className="cols" style={{ marginTop: 18 }}>
      <div><div className="card"><div className="lh"><b>{c.challenge.title}</b><span className="badge">{c.challenge.status}</span></div><p className="note">{c.challenge.description}</p><p><b>{c.matches.length}</b> selected fixtures.</p><Link className="btn p sm" href={`/challenges/${c.challenge.id}`}>Open challenge</Link></div></div>
      <div><h2 style={{ marginTop: 0 }}>Top this week</h2><div className="card">{board.length ? board.map(r => <div className="row" key={r.username} style={{ marginBottom: 8 }}><span>{r.rank}. @{r.username}</span><b>{r.points} pts</b></div>) : <p className="note">No joined players have settled picks yet.</p>}</div></div>
    </div>}
    {!me.signedIn && <p className="note" style={{ marginTop: 14 }}><Link href="/sign-in?next=/challenges" style={{ color: "#00e676" }}>Sign in</Link> to join and submit predictions.</p>}
  </>;
}
