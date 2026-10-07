import "server-only";
import { NextResponse } from "next/server";
import { z } from "zod";
import { getViewer } from "@/lib/app/session";
import { hasTier } from "@/lib/entitlements";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { isFrozen, movement, type VersionRow } from "./versioning";
const q = z.object({ matchId: z.string().regex(/^(sm|fd):\d+$/) });
/** Shared by the history and movement endpoints. Signed-in users only. */
export async function loadVersions(req: Request): Promise<NextResponse | { matchId: string; versions: VersionRow[]; frozen: boolean }> {
  const v = await getViewer(); if (!hasTier(v.tier, "pro")) return NextResponse.json({ error: "Prediction history needs a free account. Sign in to use it." }, { status: 403 });
  const p = q.safeParse({ matchId: new URL(req.url).searchParams.get("matchId") }); if (!p.success) return NextResponse.json({ error: "matchId is required" }, { status: 400 });
  const { data, error } = await supabaseAdmin().from("prediction_versions").select("version,created_at,engine_version,p_home,p_draw,p_away,confidence,kickoff_utc").eq("match_id", p.data.matchId).order("version"); if (error) return NextResponse.json({ error: "History is temporarily unavailable" }, { status: 503 });
  const rows = data ?? []; return { matchId: p.data.matchId, frozen: rows.length ? isFrozen(Date.parse(rows[0].kickoff_utc as string)) : false, versions: rows.map(r => ({ version: r.version as number, createdAt: r.created_at as string, engineVersion: r.engine_version as string, pHome: Number(r.p_home), pDraw: Number(r.p_draw), pAway: Number(r.p_away), confidence: (r.confidence as number | null) ?? null })) };
}
export { movement };
