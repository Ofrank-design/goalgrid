import { NextResponse } from "next/server";
import { z } from "zod";
import { predictOne } from "@/lib/engine/predictions";
import { currentTier, hasTier } from "@/lib/entitlements";
import { log } from "@/lib/logging/logger";
export const maxDuration = 60;
const q = z.object({ date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), id: z.string().regex(/^(sm|fd):\d+$/) });
/** One match call: all 50 models run on the fixture with its market odds, weather and kickoff time. Models without data abstain and are listed. */
export async function GET(req: Request) {
  const sp = new URL(req.url).searchParams, p = q.safeParse({ date: sp.get("date"), id: sp.get("id") });
  if (!p.success) return NextResponse.json({ error: "date (YYYY-MM-DD) and id (sm:123 or fd:123) are required" }, { status: 400 });
  try {
    const tier = await currentTier().catch(() => "free" as const), deep = hasTier(tier, "pro"), r = await predictOne(p.data.date, p.data.id);
    if (!r) return NextResponse.json({ error: "Match not found" }, { status: 404 });
    const pr = r.prediction ? (deep ? r.prediction : { ...r.prediction, models: [], abstained: [] }) : null;
    return NextResponse.json({ tier, match: r.match, prediction: pr, reason: r.reason ?? null, ...(deep ? { metrics: r.leagueMetrics } : {}) }, { headers: { "Cache-Control": "private, max-age=60" } });
  } catch (e) { log.error("match prediction failed", { message: (e as Error).message }); return NextResponse.json({ error: "Prediction is temporarily unavailable" }, { status: 503 }); }
}
