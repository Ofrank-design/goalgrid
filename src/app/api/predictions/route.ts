import { NextResponse } from "next/server";
import { z } from "zod";
import { getPredictions } from "@/lib/engine/predictions";
import { currentTier, hasTier } from "@/lib/entitlements";
import { log } from "@/lib/logging/logger";
export const maxDuration = 60;
const q = z.object({ date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(d => !Number.isNaN(Date.parse(d))).optional() });
/** Free callers get the headline numbers. Pro and above also get the per model breakdown and model metrics. */
export async function GET(req: Request) {
  const p = q.safeParse({ date: new URL(req.url).searchParams.get("date") ?? undefined });
  if (!p.success) return NextResponse.json({ error: "date must be YYYY-MM-DD" }, { status: 400 });
  const date = p.data.date ?? new Date().toISOString().slice(0, 10);
  try {
    const tier = await currentTier().catch(() => "free" as const), deep = hasTier(tier, "pro"), crests = process.env.GOALGRID_ALLOW_CRESTS !== "false";
    const r = await getPredictions(date);
    const items = r.items.map(({ match, prediction, reason }) => ({
      match: crests ? match : { ...match, home: { ...match.home, crestUrl: null }, away: { ...match.away, crestUrl: null } },
      prediction: prediction ? (deep ? prediction : { ...prediction, models: [] }) : null, reason: reason ?? null }));
    return NextResponse.json({ date, source: r.source, stale: r.stale, tier, items, ...(deep ? { leagues: r.leagues } : {}) }, { headers: { "Cache-Control": "private, max-age=60" } });
  } catch (e) { log.error("predictions unavailable", { date, message: (e as Error).message }); return NextResponse.json({ error: "Predictions are temporarily unavailable" }, { status: 503 }); }
}
