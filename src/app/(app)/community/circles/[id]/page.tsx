import Link from "next/link";
import { notFound } from "next/navigation";

import { CircleMemberManager } from "@/components/CircleMemberManager";
import { Composer } from "@/components/Composer";
import { PostList } from "@/components/PostList";
import { requireMember } from "@/lib/community/api";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export default async function CirclePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const viewer = await requireMember();

  if (viewer instanceof Response) {
    return (
      <div className="gate">
        <h1>Sign in first</h1>
        <Link className="btn p" href="/sign-in?next=/community/circles">
          Sign in
        </Link>
      </div>
    );
  }

  const circleId = (await params).id;
  const db = supabaseAdmin();

  const [{ data: circle }, { data: membership }] = await Promise.all([
    db
      .from("private_circles")
      .select("id,name,description,owner_id")
      .eq("id", circleId)
      .maybeSingle(),
    db
      .from("private_circle_members")
      .select("role")
      .eq("circle_id", circleId)
      .eq("user_id", viewer.id)
      .maybeSingle(),
  ]);

  if (!circle || !membership) {
    notFound();
  }

  const { data: posts } = await db
    .from("posts")
    .select("id,match_id,parent_id,body,created_at,user_id")
    .eq("circle_id", circleId)
    .eq("status", "visible")
    .order("created_at", { ascending: false })
    .limit(80);

  const authorIds = [
    ...new Set((posts ?? []).map((post) => post.user_id as string)),
  ];

  const { data: profiles } = authorIds.length
    ? await db
        .from("profiles")
        .select("id,username")
        .in("id", authorIds)
    : { data: [] as { id: string; username: string }[] };

  const usernames = new Map(
    (profiles ?? []).map((profile) => [
      profile.id as string,
      profile.username as string,
    ]),
  );

  const repliesByPost = new Map<string, typeof posts>();
  for (const post of posts ?? []) {
    if (!post.parent_id) continue;
    const replies = repliesByPost.get(post.parent_id) ?? [];
    replies.push(post);
    repliesByPost.set(post.parent_id, replies);
  }

  const threads = (posts ?? [])
    .filter((post) => !post.parent_id)
    .map((post) => ({
      id: post.id,
      match_id: post.match_id,
      parent_id: post.parent_id,
      body: post.body,
      created_at: post.created_at,
      username: usernames.get(post.user_id as string) || "member",
      likes: 0,
      replies: (repliesByPost.get(post.id) ?? []).map((reply) => ({
        id: reply.id,
        match_id: reply.match_id,
        parent_id: reply.parent_id,
        body: reply.body,
        created_at: reply.created_at,
        username: usernames.get(reply.user_id as string) || "member",
        likes: 0,
      })),
    }));

  return (
    <>
      <div className="row">
        <div>
          <h1>{circle.name}</h1>
          <p className="sub">
            {circle.description || "Private GoalGrid discussion circle."}
          </p>
        </div>
        <Link className="btn sm" href="/community/circles">
          All circles
        </Link>
      </div>

      {circle.owner_id === viewer.id && (
        <CircleMemberManager circleId={circleId} />
      )}

      <div className="card" style={{ marginTop: 16 }}>
        <Composer circleId={circleId} placeholder="Write to this private circle" />
      </div>

      <h2>Circle discussion</h2>
      <PostList threads={threads as never} me={viewer.username} canPost />
    </>
  );
}
