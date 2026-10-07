import { NextResponse } from "next/server";
import { z } from "zod";
import { AnalysisUnavailable, getAnalysis } from "@/lib/engine/ai/analysis";
import { currentTier, hasTier } from "@/lib/entitlements";
import { log } from "@/lib/logging/logger";
const q = z.object({ date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), id: z.string().regex(/^(sm|fd):\d+$/) });
/** Pro sees the blended result and reasons. Premium also sees every model's own answer. Free is asked to upgrade. */
export async function GET(req: Request) {
  const sp = new URL(req.url).searchParams, p = q.safeParse({ date: sp.get("date"), id: sp.get("id") });
  if (!p.success) return NextResponse.json({ error: "date (YYYY-MM-DD) and id (sm:123 or fd:123) are required" }, { status: 400 });
  const tier = await currentTier().catch(() => "free" as const);
  if (!hasTier(tier, "pro")) return NextResponse.json({ error: "AI analysis needs a free account. Sign in to use it.", requiredTier: "pro" }, { status: 403 });
  try {
    const a = await getAnalysis(p.data.date, p.data.id);
    return NextResponse.json({ tier, analysis: hasTier(tier, "premium") ? a : { ...a, perModel: [] } }, { headers: { "Cache-Control": "private, max-age=120" } });
  } catch (e) {
    if (e instanceof AnalysisUnavailable) return NextResponse.json({ error: e.message }, { status: 404 });
    log.error("analysis failed", { message: (e as Error).message }); return NextResponse.json({ error: "Analysis is temporarily unavailable" }, { status: 503 });
  }
}
