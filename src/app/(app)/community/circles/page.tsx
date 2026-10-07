import Link from "next/link";
import { NextResponse } from "next/server";

import { CircleCreate } from "@/components/CircleCreate";
import { requireMember } from "@/lib/community/api";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export default async function CirclesPage() {
  const viewer = await requireMember();

  if (viewer instanceof NextResponse) {
    return (
      <div className="gate">
        <h1>Sign in first</h1>
        <Link className="btn p" href="/sign-in?next=/community/circles">
          Sign in
        </Link>
      </div>
    );
  }

  const { data: circles } = await supabaseAdmin()
    .from("private_circle_members")
    .select(
      "circle_id,role,private_circles(id,name,description,owner_id)",
    )
    .eq("user_id", viewer.id)
    .order("joined_at", { ascending: false });

  return (
    <>
      <div className="row">
        <div>
          <h1>Private circles</h1>
          <p className="sub">
            Small member-only football discussions. Circle posts never enter the
            public feed.
          </p>
        </div>
        <Link className="btn sm" href="/community">
          Community
        </Link>
      </div>

      <div className="card">
        <CircleCreate />
      </div>

      <h2>Your circles</h2>

      {circles?.length ? (
        <div className="grid">
          {circles.map((membership) => {
            const circle = membership.private_circles as unknown as {
              id: string;
              name: string;
              description: string | null;
              owner_id: string;
            } | null;

            return (
              <Link
                className="card link"
                key={membership.circle_id}
                href={`/community/circles/${membership.circle_id}`}
              >
                <b>{circle?.name}</b>
                <p className="note">
                  {circle?.description || "Private discussion circle."}
                </p>
                <span className="chip">{membership.role}</span>
              </Link>
            );
          })}
        </div>
      ) : (
        <div className="card">
          <p className="note">No circles yet.</p>
        </div>
      )}
    </>
  );
}
