import { NextResponse } from "next/server";
import { z } from "zod";
import { getViewer } from "@/lib/app/session";
import { hasTier } from "@/lib/entitlements";
import { ENGINE_VERSION, analyse } from "@/lib/lab/stats";
import { isDelayed, loadSeries } from "@/lib/lab/data";
import { metaOf, observationsCsv } from "@/lib/lab/export";
const q = z.object({ game: z.string().regex(/^[a-z0-9-]{2,40}$/), source: z.string().regex(/^[a-z0-9-]{2,40}$/), range: z.enum(["1H", "24H", "7D", "30D", "ALL"]).default("24H"), format: z.enum(["csv", "json"]).default("csv"), window: z.coerce.number().int().min(5).max(200).default(20), threshold: z.coerce.number().min(0).max(1000).default(2) });
/** GET /api/lab/export. Signed-in users only. CSV is the stored observations; JSON is the analysis with its metadata. Files are named for the game, source, range and engine version. */
export async function GET(req: Request) {
  const v = await getViewer(); if (!hasTier(v.tier, "premium")) return NextResponse.json({ error: "Exports needs a free account. Sign in to use it." }, { status: 403 });
  const p = q.safeParse(Object.fromEntries(new URL(req.url).searchParams)); if (!p.success) return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  try {
    const s = await loadSeries(p.data.game, p.data.source, p.data.range); if (!s.values.length) return NextResponse.json({ message: "No data available" }, { status: 404 });
    const meta = metaOf({ game: p.data.game, source: p.data.source, range: p.data.range, engineVersion: ENGINE_VERSION, observations: s.values.length }), name = `${p.data.game}-${p.data.source}-${p.data.range}-${ENGINE_VERSION}`;
    const headers = { "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" };
    if (p.data.format === "csv") return new NextResponse(`# ${meta.note}\r\n# ${meta.game} / ${meta.source} / ${meta.range} / ${meta.engineVersion} / exported ${meta.exportedAt}\r\n${observationsCsv(s.values, s.times)}`, { headers: { ...headers, "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="${name}.csv"` } });
    return new NextResponse(JSON.stringify({ meta, delayed: isDelayed(s.lastObservedAt), analysis: analyse(s.values, { window: p.data.window, threshold: p.data.threshold, times: s.times }) }, null, 2), { headers: { ...headers, "Content-Type": "application/json", "Content-Disposition": `attachment; filename="${name}.json"` } });
  } catch { return NextResponse.json({ error: "Export is temporarily unavailable" }, { status: 503 }); }
}
