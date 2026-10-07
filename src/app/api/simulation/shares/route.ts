import { NextResponse } from "next/server";
import { z } from "zod";
import { researchQuality, checkShare } from "@/lib/simulation/strategy";
import { proGate } from "@/lib/simulation/server";
import { addendumOn } from "@/lib/simulation/route";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { LIMIT_MESSAGE, allow } from "@/lib/security/limits";
import { parseBlocked } from "@/lib/community/rules";
const body = z.object({ runId: z.string().uuid(), title: z.string().trim().min(3).max(80), summary: z.string().trim().min(20).max(300), method: z.string().trim().max(600).optional() });
/** Strategy library. Users share the settings of one of their own runs, never code, and never anything that claims profit, asks for money or promotes a bookmaker. Ranked by research quality, not by claimed returns. */
export async function POST(req: Request) {
  if (!addendumOn()) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const g = await proGate(); if (g instanceof NextResponse) return g; const p = body.safeParse(await req.json().catch(() => null)); if (!p.success) return NextResponse.json({ error: "Add a title, a summary of at least 20 characters, and choose one of your runs." }, { status: 400 });
  if (!(await allow(g.id, "note"))) return NextResponse.json({ error: LIMIT_MESSAGE }, { status: 429 }); const text = `${p.data.title}\n${p.data.summary}\n${p.data.method ?? ""}`, c = checkShare(text);
  if (!c.ok) return NextResponse.json({ error: "This can't be shared.", reasons: c.reasons }, { status: 400 }); if (parseBlocked(process.env.BLOCKED_TERMS).some(t => text.toLowerCase().includes(t))) return NextResponse.json({ error: "That breaks the community rules." }, { status: 400 });
  const db = supabaseAdmin(), { data: run } = await db.from("simulation_runs").select("id,kind,configuration,seed,record_count").eq("id", p.data.runId).eq("user_id", g.id).maybeSingle(); if (!run) return NextResponse.json({ error: "Run not found" }, { status: 404 });
  const { data, error } = await db.from("simulation_shares").insert({ user_id: g.id, run_id: run.id, title: p.data.title, summary: p.data.summary, method: p.data.method ?? null, kind: run.kind, configuration: run.configuration, seed: run.seed, sample_size: run.record_count }).select("id").single();
  return error ? NextResponse.json({ error: "Could not share." }, { status: 500 }) : NextResponse.json({ id: data.id }, { status: 201 });
}
export async function GET() {
  if (!addendumOn()) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const g = await proGate(); if (g instanceof NextResponse) return g; const db = supabaseAdmin(), { data } = await db.from("simulation_shares").select("id,title,summary,method,kind,configuration,seed,sample_size,created_at,profiles(username)").eq("status", "active").order("created_at", { ascending: false }).limit(60);
  const ids = (data ?? []).map(s => s.id as string), likes = new Map<string, number>(); if (ids.length) (await db.from("simulation_share_likes").select("share_id").in("share_id", ids)).data?.forEach(l => likes.set(l.share_id as string, (likes.get(l.share_id as string) ?? 0) + 1));
  const shares = (data ?? []).map(s => { const q = researchQuality({ hasSeed: !!s.seed, sampleSize: s.sample_size as number, hasAssumptions: (s.summary as string).length >= 40, hasMethod: !!s.method, likes: likes.get(s.id as string) ?? 0 }); return { id: s.id, title: s.title, summary: s.summary, method: s.method, kind: s.kind, seed: s.seed, sampleSize: s.sample_size, createdAt: s.created_at, author: (s as unknown as { profiles?: { username?: string } }).profiles?.username ?? null, likes: likes.get(s.id as string) ?? 0, quality: q }; }).sort((a, b) => b.quality.score - a.quality.score);
  return NextResponse.json({ shares, ranking: "Ranked by research quality: reproducibility, sample size, stated assumptions, methodology and peer feedback. Never by claimed profit." });
}
