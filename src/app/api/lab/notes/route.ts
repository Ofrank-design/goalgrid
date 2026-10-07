import { NextResponse } from "next/server";
import { z } from "zod";
import { getViewer } from "@/lib/app/session";
import { requireUser } from "@/lib/community/api";
import { hasTier } from "@/lib/entitlements";
import { LIMIT_MESSAGE, allow } from "@/lib/security/limits";
import { supabaseAdmin } from "@/lib/supabase/admin";
const post = z.object({ game: z.string().regex(/^[a-z0-9-]{2,40}$/), range: z.enum(["1H", "24H", "7D", "30D", "ALL"]).optional(), runId: z.string().uuid().optional(), metric: z.string().max(40).optional(), body: z.string().trim().min(1).max(500) });
const gate = async () => { const v = await getViewer(), u = await requireUser(); return u && hasTier(v.tier, "premium") ? u : null; };
/** Research notes. Premium only, private to the author, and never able to change a source observation. */
export async function POST(req: Request) {
  const u = await gate(); if (!u) return NextResponse.json({ error: "Research notes needs a free account. Sign in to use it." }, { status: 403 }); const p = post.safeParse(await req.json().catch(() => null)); if (!p.success) return NextResponse.json({ error: "Write a note of up to 500 characters." }, { status: 400 });
  if (!(await allow(u.id, "note"))) return NextResponse.json({ error: LIMIT_MESSAGE }, { status: 429 }); const db = supabaseAdmin();
  if (p.data.runId) { const { data } = await db.from("analysis_runs").select("id").eq("id", p.data.runId).eq("user_id", u.id).maybeSingle(); if (!data) return NextResponse.json({ error: "Run not found" }, { status: 404 }); }
  const { data, error } = await db.from("lab_notes").insert({ user_id: u.id, game_id: p.data.game, time_range: p.data.range ?? null, run_id: p.data.runId ?? null, metric: p.data.metric ?? null, body: p.data.body.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, "") }).select("id").single();
  return error ? NextResponse.json({ error: "Could not save the note" }, { status: 500 }) : NextResponse.json({ id: data.id }, { status: 201 });
}
export async function GET(req: Request) {
  const u = await gate(); if (!u) return NextResponse.json({ error: "Research notes needs a free account. Sign in to use it." }, { status: 403 }); const game = new URL(req.url).searchParams.get("game");
  let q = supabaseAdmin().from("lab_notes").select("id,game_id,time_range,run_id,metric,body,created_at").eq("user_id", u.id).order("created_at", { ascending: false }).limit(50); if (game && /^[a-z0-9-]{2,40}$/.test(game)) q = q.eq("game_id", game);
  return NextResponse.json({ notes: (await q).data ?? [] });
}
export async function DELETE(req: Request) {
  const u = await gate(); if (!u) return NextResponse.json({ error: "Research notes needs a free account. Sign in to use it." }, { status: 403 }); const id = new URL(req.url).searchParams.get("id"); if (!z.string().uuid().safeParse(id).success) return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  await supabaseAdmin().from("lab_notes").delete().eq("id", id).eq("user_id", u.id); return NextResponse.json({ ok: true });
}
