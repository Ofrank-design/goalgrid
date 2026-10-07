import { NextResponse } from "next/server";
import { z } from "zod";
import { proGate } from "@/lib/simulation/server";
import { addendumOn } from "@/lib/simulation/route";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { LIMIT_MESSAGE, allow } from "@/lib/security/limits";
const body = z.object({ action: z.enum(["like", "report"]), reason: z.string().max(200).optional() });
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  if (!addendumOn()) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const g = await proGate(); if (g instanceof NextResponse) return g; const { id } = await ctx.params, p = body.safeParse(await req.json().catch(() => null)); if (!z.string().uuid().safeParse(id).success || !p.success) return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  if (!(await allow(g.id, p.data.action === "like" ? "like" : "report"))) return NextResponse.json({ error: LIMIT_MESSAGE }, { status: 429 }); const db = supabaseAdmin(), { data: s } = await db.from("simulation_shares").select("id,user_id,status").eq("id", id).maybeSingle(); if (!s || s.status !== "active") return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (p.data.action === "like") { const { data: had } = await db.from("simulation_share_likes").select("share_id").eq("share_id", id).eq("user_id", g.id).maybeSingle(); if (had) await db.from("simulation_share_likes").delete().eq("share_id", id).eq("user_id", g.id); else await db.from("simulation_share_likes").insert({ share_id: id, user_id: g.id }); return NextResponse.json({ liked: !had }); }
  if (s.user_id === g.id) return NextResponse.json({ error: "You can't report your own share." }, { status: 400 }); await db.from("simulation_share_reports").upsert({ share_id: id, reporter_id: g.id, reason: p.data.reason ?? null }, { onConflict: "share_id,reporter_id" });
  const { count } = await db.from("simulation_share_reports").select("share_id", { count: "exact", head: true }).eq("share_id", id); if ((count ?? 0) >= 3) await db.from("simulation_shares").update({ status: "hidden" }).eq("id", id).eq("status", "active"); return NextResponse.json({ reported: true });
}
