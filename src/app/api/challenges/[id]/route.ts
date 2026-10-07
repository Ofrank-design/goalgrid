import { NextResponse } from "next/server";
import { z } from "zod";
import { requireMember } from "@/lib/community/api";
import { joinChallenge } from "@/lib/community/challenges";
import { allow } from "@/lib/security/limits";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const me = await requireMember(); if (me instanceof NextResponse) return me;
  if (!(await allow(me.id, "prediction"))) return NextResponse.json({ error: "Too many requests." }, { status: 429 });
  const { id } = await params;
  const body = z.object({ action: z.literal("join") }).safeParse(await req.json().catch(() => null));
  if (!body.success) return NextResponse.json({ error: "Invalid action." }, { status: 400 });
  const result = await joinChallenge(id, me.id);
  return result.ok ? NextResponse.json(result) : NextResponse.json({ error: result.error }, { status: 409 });
}
