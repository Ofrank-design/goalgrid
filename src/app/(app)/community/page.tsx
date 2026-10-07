import Link from "next/link";
import { Composer } from "@/components/Composer";
import { PostList } from "@/components/PostList";
import { UsernameForm } from "@/components/UsernameForm";
import { loadDay } from "@/lib/app/data";
import { kickoffLabel, todayUtc } from "@/lib/app/format";
import { getFeed, getLeaderboard, getMe } from "@/lib/community/server";
export const dynamic = "force-dynamic";
export default async function Community() {
  const date = todayUtc(), [me, day, board, feed] = await Promise.all([getMe(), loadDay(date), getLeaderboard("week", 5), getFeed(null)]);
  const matches = day.ok ? [...day.data.items].sort((a, b) => a.match.kickoffUtc.localeCompare(b.match.kickoffUtc)) : [];
  return (<>
    <div className="row"><div><h1>Community Center</h1><p className="sub">Debate every fixture, make a prediction and climb a leaderboard that rewards calibrated thinking, not noise.</p></div><Link className="btn sm" href="/leaderboard">Full leaderboard</Link></div>
    {me.signedIn && !me.username && <div style={{ marginTop: 18 }}><UsernameForm /></div>}
    <div className="cols" style={{ marginTop: 22 }}>
      <div>
        <h2 style={{ marginTop: 0 }}>Today's match threads</h2>
        {!matches.length && <div className="card"><p className="note">No fixtures today in the tracked leagues.</p></div>}
        <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fill,minmax(240px,1fr))" }}>{matches.map(({ match: m }) => <Link key={m.id} href={`/community/matches/${encodeURIComponent(m.id)}?date=${date}`} className="card link" style={{ display: "block" }}><div className="lh"><span>{m.league.name}</span><span style={{ marginLeft: "auto" }}>{kickoffLabel(m.kickoffUtc)}</span></div><b>{m.home.name} vs {m.away.name}</b></Link>)}</div>
        <h2>General discussion</h2>
        {me.username ? <div className="card" style={{ marginBottom: 14 }}><Composer placeholder="Share a thought about the football" /></div> : <p className="note" style={{ marginBottom: 14 }}>{me.signedIn ? "Choose a username to post." : <><Link href="/sign-in?next=/community" style={{ color: "#00e676" }}>Sign in</Link> to join the conversation.</>}</p>}
        <PostList threads={feed} me={me.username} canPost={Boolean(me.username)} />
      </div>
      <div><h2 style={{ marginTop: 0 }}>Top predictors this week</h2><div className="card">{board.length ? board.map((r, i) => <div key={r.username} className="row" style={{ margin: "0 0 8px" }}><span>{i + 1}. @{r.username}</span><b style={{ color: "#00e676" }}>{r.points} pts</b></div>) : <p className="note">No one has three settled picks this week yet.</p>}</div></div>
    </div>
  </>);
}
