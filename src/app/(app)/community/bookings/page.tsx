import Link from "next/link";
import { PageHero } from "@/components/PageHero";
import { BookingActions } from "@/components/BookingActions";
import { BookingComposer } from "@/components/BookingComposer";
import { VERIFICATION_LABEL, type Verification } from "@/lib/community/booking";
import { bookingFeed } from "@/lib/community/bookings-server";
import { getMe } from "@/lib/community/server";
import { supabaseServer } from "@/lib/supabase/server";
export const dynamic = "force-dynamic";
export default async function Bookings() {
  const me = await getMe(), sb = await supabaseServer(), { data: { user } } = await sb.auth.getUser(); let cards: Awaited<ReturnType<typeof bookingFeed>> = [], failed = false;
  try { cards = await bookingFeed(user?.id ?? null); } catch { failed = true; }
  return (<>
    <PageHero image="community" title="Community booking codes" subtitle="Shared by members. Community submissions, not GoalGrid predictions: they never count toward records, leaderboards or trophies." position="50% 40%"><Link className="btn sm" href="/community" style={{ justifySelf: "start" }}>Back to Community</Link></PageHero>
    <div className="card" style={{ marginTop: 18 }}>{me.username ? <BookingComposer /> : <p className="note">{me.signedIn ? "Choose a username in the Community Center to share codes." : <>Sign in to share a code. <Link href="/sign-in?next=/community/bookings">Sign in</Link></>}</p>}</div>
    <h2>Latest shares</h2>{failed && <div className="err">Shares are temporarily unavailable.</div>}{!failed && !cards.length && <div className="card"><p className="note">No booking codes have been shared yet.</p></div>}
    <div style={{ display: "grid", gap: 12 }}>{cards.map(c => <div key={c.id} className="card"><div className="lh"><Link href={`/profile/${c.username}`}>@{c.username}</Link><span style={{ marginLeft: "auto" }}>{new Date(c.createdAt).toUTCString().slice(5, 22)} UTC</span></div>
      <b style={{ fontFamily: "monospace", fontSize: 18 }}>{c.bookingCode}</b><div className="meta">{c.bookmaker && <span>{c.bookmaker}</span>}{c.odds && <span>Odds {c.odds}</span>}{c.hasProof && <span>Image attached</span>}<span>{VERIFICATION_LABEL[c.verification as Verification] ?? c.verification}</span></div>
      {c.note && <p>{c.note}</p>}<BookingActions id={c.id} username={c.username} likes={c.likes} comments={c.comments} canAct={Boolean(me.username)} mine={c.username === me.username} /></div>)}</div>
    <p className="note" style={{ marginTop: 16 }}>Bet responsibly. 18+. Nobody can promise a result.</p></>);
}
