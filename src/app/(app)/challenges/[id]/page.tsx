import Link from "next/link";
import { getChallenge, getChallengeLeaderboard } from "@/lib/community/challenges";
import { getMe } from "@/lib/community/server";
import { requireUser } from "@/lib/community/api";
import { PickForm } from "@/components/PickForm";
import { kickoffLabel, nowMs } from "@/lib/app/format";
import { JoinChallengeButton } from "@/components/JoinChallengeButton";
export const dynamic = "force-dynamic";
export default async function ChallengePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const me = await getMe();
  const user = await requireUser();
  const detail = await getChallenge(id, user?.id);
  if (!detail) return <div className="err">Challenge not found.</div>;
  const board = await getChallengeLeaderboard(id, 50);
  return <>
    <p className="note"><Link href="/challenges" style={{ color: "#00e676" }}>Back to Challenges</Link></p>
    <div className="row"><div><h1>{detail.challenge.title}</h1><p className="sub">{detail.challenge.description}</p></div><span className="badge">{detail.challenge.status}</span></div>
    <div className="cols" style={{ marginTop: 18 }}>
      <div><div className="card"><div className="lh"><b>Selected fixtures</b><span>{detail.matches.length}</span></div>{detail.matches.map(m => <div key={m.match_id} className="card" style={{ marginTop: 10 }}><div className="lh"><span>{m.league_slug}</span><span>{kickoffLabel(m.kickoff_utc)}</span></div><b>{m.home_name} vs {m.away_name}</b>{me.signedIn && detail.joined ? <PickForm matchId={m.match_id} date={m.match_date} existing={detail.picks[m.match_id] ?? null} open={m.kickoff_utc ? Date.parse(m.kickoff_utc) > nowMs() + 60_000 : false} /> : <p className="note" style={{ marginTop: 8 }}>{me.signedIn ? "Join the challenge to make your pick." : "Sign in to make your pick."}</p>}</div>)}</div>
        {!me.signedIn ? <Link className="btn p sm" href={`/sign-in?next=/challenges/${id}`}>Sign in</Link> : !detail.joined ? <JoinChallengeButton challengeId={id} /> : <p className="note">You're joined. Your normal GoalGrid predictions for these fixtures are the records used to score this challenge.</p>}
      </div>
      <div><h2 style={{ marginTop: 0 }}>Challenge standings</h2><div className="card">{board.length ? board.map(r => <div className="row" key={r.username} style={{ marginBottom: 8 }}><span>{r.rank}. @{r.username}</span><span>{r.points} pts · {r.accuracy}%</span></div>) : <p className="note">No settled challenge picks yet.</p>}</div></div>
    </div>
  </>;
}
