import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/community/api";
import { getViewer } from "@/lib/app/session";
import { hasTier } from "@/lib/entitlements";
import { loadSeries } from "@/lib/lab/data";
import { saveRun } from "@/lib/lab/runs";
import { ENGINE_VERSION, analyse } from "@/lib/lab/stats";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { LIMIT_MESSAGE, allow } from "@/lib/security/limits";
const body = z.object({ game: z.string().regex(/^[a-z0-9-]{2,40}$/), source: z.string().regex(/^[a-z0-9-]{2,40}$/), range: z.enum(["1H", "24H", "7D", "30D", "ALL"]).default("24H"), window: z.number().int().min(5).max(200).default(20), threshold: z.number().min(0).max(1000).default(2) });
/** POST saves the current analysis as a run (computed on the server from stored data, never from numbers the browser sends). GET lists your runs, newest first. Signed-in users only. */
export async function POST(req: Request) {
  const v = await getViewer(), u = await requireUser(); if (!u || !hasTier(v.tier, "premium")) return NextResponse.json({ error: "Saved runs needs a free account. Sign in to use it." }, { status: 403 });
  if (!(await allow(u.id, "labRun"))) return NextResponse.json({ error: LIMIT_MESSAGE }, { status: 429 });
  const p = body.safeParse(await req.json().catch(() => null)); if (!p.success) return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  try { const s = await loadSeries(p.data.game, p.data.source, p.data.range); if (!s.values.length) return NextResponse.json({ message: "No data available" }, { status: 404 });
    const id = await saveRun(u.id, { gameId: p.data.game, sourceId: p.data.source, params: p.data, result: analyse(s.values, { window: p.data.window, threshold: p.data.threshold, times: s.times }), engineVersion: ENGINE_VERSION, observations: s.values.length }); return NextResponse.json({ id }, { status: 201 });
  } catch { return NextResponse.json({ error: "Could not save the run" }, { status: 503 }); }
}
export async function GET() {
  const v = await getViewer(), u = await requireUser(); if (!u || !hasTier(v.tier, "premium")) return NextResponse.json({ error: "Saved runs needs a free account. Sign in to use it." }, { status: 403 });
  const { data } = await supabaseAdmin().from("analysis_runs").select("id,game_id,source_id,params,engine_version,observation_count,created_at").eq("user_id", u.id).order("created_at", { ascending: false }).limit(50); return NextResponse.json({ runs: data ?? [] });
}
