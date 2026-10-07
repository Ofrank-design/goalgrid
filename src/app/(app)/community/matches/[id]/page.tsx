import Link from "next/link";
import { notFound } from "next/navigation";
import { Composer } from "@/components/Composer";
import { PickForm } from "@/components/PickForm";
import { MarketPickForm } from "@/components/MarketPickForm";
import { PostList } from "@/components/PostList";
import { UsernameForm } from "@/components/UsernameForm";
import { loadDay } from "@/lib/app/data";
import { kickoffLabel, nowMs, pct, todayUtc, validDate } from "@/lib/app/format";
import { getFeed, getMe, getMyMarketPicks, getMyPick } from "@/lib/community/server";
export const dynamic = "force-dynamic";
export default async function MatchThread({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ date?: string }> }) {
  const id = decodeURIComponent((await params).id), date = validDate((await searchParams).date) ?? todayUtc(); if (!/^(sm|fd):\d+$/.test(id)) notFound();
  const [me, day, feed, mine, extras] = await Promise.all([getMe(), loadDay(date), getFeed(id), getMyPick(id), getMyMarketPicks(id)]); if (!day.ok) return <div className="err">{day.error}</div>;
  const item = day.data.items.find(i => i.match.id === id); if (!item) notFound();
  const { match: m, prediction: p } = item, open = m.status === "scheduled" && Date.parse(m.kickoffUtc) > nowMs() + 60_000;
  return (<>
    <p className="note"><Link href="/community" style={{ color: "#00e676" }}>Back to the Community Center</Link></p>
    <div className="row" style={{ marginTop: 10 }}><div><h1>{m.home.name} vs {m.away.name}</h1><p className="sub">{m.league.name}, {kickoffLabel(m.kickoffUtc)} on {date}.</p></div><Link className="btn sm" href={`/matches/${encodeURIComponent(m.id)}?date=${date}`}>Match analysis</Link></div>
    <div className="cols" style={{ marginTop: 18 }}>
      <div><h2 style={{ marginTop: 0 }}>Thread</h2>
        {me.username ? <div className="card" style={{ marginBottom: 14 }}><Composer matchId={id} placeholder={`What do you make of ${m.home.name} vs ${m.away.name}?`} /></div> : me.signedIn ? <div style={{ marginBottom: 14 }}><UsernameForm /></div> : <p className="note" style={{ marginBottom: 14 }}><Link href={`/sign-in?next=/community/matches/${encodeURIComponent(id)}`} style={{ color: "#00e676" }}>Sign in</Link> to join the thread.</p>}
        <PostList threads={feed} matchId={id} me={me.username} canPost={Boolean(me.username)} /></div>
      <div><h2 style={{ marginTop: 0 }}>Your prediction</h2><div className="card">{me.username ? <><PickForm matchId={id} date={date} existing={mine} open={open} /><div style={{ marginTop: 16 }}><MarketPickForm matchId={id} date={date} existing={extras} open={open} /></div></> : <p className="note">{me.signedIn ? "Choose a username to make a pick." : "Sign in to make a pick."}</p>}</div>
        {p && <><h2>GoalGrid says</h2><div className="card"><div className="pl"><div><b>{pct(p.probabilities.home)}</b>Home</div><div><b>{pct(p.probabilities.draw)}</b>Draw</div><div><b>{pct(p.probabilities.away)}</b>Away</div></div></div></>}</div>
    </div>
  </>);
}
