import { NextResponse } from "next/server";
import { z } from "zod";
import { getViewer } from "@/lib/app/session";
import { hasTier } from "@/lib/entitlements";
import { ENGINE_VERSION, analyse } from "@/lib/lab/stats";
import { isDelayed, loadSeries } from "@/lib/lab/data";
export const maxDuration = 30;
const q = z.object({ game: z.string().regex(/^[a-z0-9-]{2,40}$/), source: z.string().regex(/^[a-z0-9-]{2,40}$/), range: z.enum(["1H", "24H", "7D", "30D", "ALL"]).default("24H"), window: z.coerce.number().int().min(5).max(200).default(20), threshold: z.coerce.number().min(0).max(1000).default(2) });
/** GET /api/lab/analysis. Signed-in users only. Every number comes from stored observations; with none stored the reply says so. */
export async function GET(req: Request) {
  const v = await getViewer(); if (!hasTier(v.tier, "premium")) return NextResponse.json({ error: "Game Intelligence needs a free account. Sign in to use it." }, { status: 403 });
  const sp = Object.fromEntries(new URL(req.url).searchParams), p = q.safeParse(sp); if (!p.success) return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  try {
    const s = await loadSeries(p.data.game, p.data.source, p.data.range);
    if (!s.values.length) return NextResponse.json({ message: "No data available", observations: 0 });
    return NextResponse.json({ engineVersion: ENGINE_VERSION, observations: s.values.length, partialObservations: s.partial, lastObservedAt: s.lastObservedAt, delayed: isDelayed(s.lastObservedAt), params: p.data, ...analyse(s.values, { window: p.data.window, threshold: p.data.threshold, times: s.times }) }, { headers: { "Cache-Control": "private, max-age=15" } });
  } catch { return NextResponse.json({ error: "Analysis is temporarily unavailable" }, { status: 503 }); }
}
