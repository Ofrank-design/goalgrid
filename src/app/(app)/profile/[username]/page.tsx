import Link from "next/link";
import { notFound } from "next/navigation";
import { SocialButtons } from "@/components/SocialButtons";
import { bookingFeed, hiddenAuthors } from "@/lib/community/bookings-server";
import { marketTotals, type SettledMarket } from "@/lib/community/markets";
import { MIN_PUBLIC_SAMPLE, recordOf, type SettledPick } from "@/lib/community/userstats";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { supabaseServer } from "@/lib/supabase/server";
export const dynamic = "force-dynamic";
export default async function Profile({ params }: { params: Promise<{ username: string }> }) {
  const { username } = await params; if (!/^[a-z0-9_]{3,20}$/.test(username)) notFound();
  const db = supabaseAdmin(), { data: p } = await db.from("profiles").select("id,username,display_name,bio,created_at,account_status").eq("username", username).maybeSingle(); if (!p || p.account_status === "banned") notFound();
  const { data: { user } } = await (await supabaseServer()).auth.getUser(), viewer = user?.id ?? null; if (viewer && viewer !== p.id && (await hiddenAuthors(viewer)).has(p.id as string)) { const [{ count: b }] = await Promise.all([db.from("blocks").select("blocker_id", { count: "exact", head: true }).eq("blocked_id", viewer).eq("blocker_id", p.id)]); if ((b ?? 0) > 0) notFound(); }
  const [{ data: settled }, { data: mk }, { data: trophies }, shares, { count: followers }, rel] = await Promise.all([
    db.from("user_predictions").select("pick,outcome,points,settled_at,home_name,away_name,confidence").eq("user_id", p.id).not("settled_at", "is", null).order("settled_at", { ascending: false }).limit(200), db.from("user_market_picks").select("market,correct").eq("user_id", p.id).not("settled_at", "is", null).not("correct", "is", null),
    db.from("user_trophies").select("code,awarded_at,trophies(name,description)").eq("user_id", p.id), bookingFeed(viewer, { username, limit: 10 }).catch(() => []), db.from("follows").select("follower_id", { count: "exact", head: true }).eq("followee_id", p.id),
    viewer ? Promise.all([db.from("follows").select("follower_id").eq("follower_id", viewer).eq("followee_id", p.id).maybeSingle(), db.from("blocks").select("blocker_id").eq("blocker_id", viewer).eq("blocked_id", p.id).maybeSingle(), db.from("mutes").select("muter_id").eq("muter_id", viewer).eq("muted_id", p.id).maybeSingle()]) : null]);
  const rec = recordOf((settled ?? []).map(r => ({ pick: r.pick, outcome: r.outcome, points: r.points, settledAt: r.settled_at }) as SettledPick)), recent = (settled ?? []).filter(r => r.outcome !== "void").slice(0, 8);
  const tr = (trophies ?? []) as unknown as { code: string; trophies: { name: string; description: string } }[], label = { home: "Home win", draw: "Draw", away: "Away win", void: "Void" } as Record<string, string>;
  return (<>
    <div className="row"><div><h1>@{p.username}</h1><p className="sub">{p.display_name ?? ""} {p.bio ?? ""}</p><p className="note">Member since {new Date(p.created_at as string).getUTCFullYear()} · {followers ?? 0} followers</p></div>{viewer && viewer !== p.id && <SocialButtons username={username} following={!!rel?.[0].data} blocked={!!rel?.[1].data} muted={!!rel?.[2].data} />}</div>
    <h2>GoalGrid prediction record</h2><div className="card">{rec.building ? <><b>Building record</b><p className="note">{rec.evaluated} evaluated prediction{rec.evaluated === 1 ? "" : "s"}. Accuracy is shown after {MIN_PUBLIC_SAMPLE}.</p></> :
      <div className="grid">{([["Prediction accuracy", `${rec.accuracy}%`], ["Evaluated predictions", rec.evaluated], ["Correct predictions", rec.correct], ["Current streak", rec.currentStreak], ["Longest streak", rec.longestStreak], ["Points", rec.points]] as const).map(([k, v]) => <div key={k}><span className="note">{k}</span><b style={{ display: "block", fontSize: 20 }}>{v}</b></div>)}</div>}
      <div className="meta">{marketTotals((mk ?? []) as SettledMarket[]).map(t => <span key={t.market}>{({ btts: "BTTS", over25: "Over/under 2.5", exact: "Exact score" } as Record<string, string>)[t.market]}: {t.total ? `${t.correct} of ${t.total}` : "none yet"}</span>)}</div><p className="note">Only evaluated GoalGrid picks count here. Community shares never count.</p></div>
    <h2>Trophies</h2><div className="card">{tr.length ? <div className="chips">{tr.map(t => <span key={t.code} className="chip" title={t.trophies?.description}>{t.trophies?.name ?? t.code}</span>)}</div> : <p className="note">No trophies yet.</p>}</div>
    <h2>Recent predictions</h2><div className="card scroll">{recent.length ? <table><thead><tr><th>MATCH</th><th>PICK</th><th>RESULT</th></tr></thead><tbody>{recent.map((r, i) => <tr key={i}><td>{r.home_name} vs {r.away_name}</td><td>{label[r.pick]}</td><td>{r.pick === r.outcome ? "Correct" : `Incorrect (${label[r.outcome]})`}</td></tr>)}</tbody></table> : <p className="note">No evaluated predictions yet.</p>}</div>
    <h2>Community shares</h2><p className="note">Booking codes and claims. Separate from the record above.</p>{shares.length ? <div style={{ display: "grid", gap: 10 }}>{shares.map(c => <div key={c.id} className="card"><b style={{ fontFamily: "monospace" }}>{c.bookingCode}</b><div className="meta">{c.bookmaker && <span>{c.bookmaker}</span>}<span>Unverified community submission</span></div></div>)}</div> : <div className="card"><p className="note">No shared codes.</p></div>}
    <p className="note"><Link href="/leaderboard">Leaderboard</Link></p></>);
}
