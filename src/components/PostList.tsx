import { PostActions } from "./PostActions";
import { Composer } from "./Composer";
import type { Thread } from "@/lib/community/server";
const ago = (iso: string) => { const m = Math.max(1, Math.round((Date.now() - Date.parse(iso)) / 60_000)); return m < 60 ? `${m}m` : m < 1440 ? `${Math.round(m / 60)}h` : `${Math.round(m / 1440)}d`; };
export function PostList({ threads, matchId, me, canPost }: { threads: Thread[]; matchId?: string; me: string | null; canPost: boolean }) {
  if (!threads.length) return <p className="note">No posts yet. Start the conversation.</p>;
  return (<div style={{ display: "grid", gap: 12 }}>{threads.map(t => (
    <div key={t.id} className="card">
      <div className="lh"><b style={{ color: "#fbfafc" }}>@{t.username}</b><span>{ago(t.created_at)}</span></div>
      <p style={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>{t.body}</p>
      <PostActions postId={t.id} likes={t.likes} mine={t.username === me} canAct={canPost} />
      {t.replies.length > 0 && <div style={{ marginTop: 12, paddingLeft: 14, borderLeft: "2px solid #1f3340", display: "grid", gap: 10 }}>{t.replies.map(r => (
        <div key={r.id}><div className="lh"><b style={{ color: "#fbfafc" }}>@{r.username}</b><span>{ago(r.created_at)}</span></div><p style={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>{r.body}</p><PostActions postId={r.id} likes={r.likes} mine={r.username === me} canAct={canPost} /></div>))}</div>}
      {canPost && <details style={{ marginTop: 10 }}><summary>Reply</summary><div style={{ marginTop: 8 }}><Composer matchId={matchId} parentId={t.id} placeholder="Write a reply" compact /></div></details>}
    </div>))}</div>);
}
