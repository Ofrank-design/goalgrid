import { NextResponse } from "next/server";
import { z } from "zod";
import { getFixtures } from "@/lib/engine/ingestion/fixtures";
import { log } from "@/lib/logging/logger";
const q = z.object({ date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(d => !Number.isNaN(Date.parse(d))).optional() });
/** Provider crest URLs are returned by default. Set GOALGRID_ALLOW_CRESTS=false to withhold them. */
const crestsAllowed = () => process.env.GOALGRID_ALLOW_CRESTS !== "false";
export async function GET(req: Request) {
  const parsed = q.safeParse({ date: new URL(req.url).searchParams.get("date") ?? undefined });
  if (!parsed.success) return NextResponse.json({ error: "date must be YYYY-MM-DD" }, { status: 400 });
  const date = parsed.data.date ?? new Date().toISOString().slice(0, 10);
  try {
    const r = await getFixtures(date);
    const matches = crestsAllowed() ? r.matches : r.matches.map(m => ({ ...m, home: { ...m.home, crestUrl: null }, away: { ...m.away, crestUrl: null } }));
    return NextResponse.json({ date, source: r.source, stale: r.stale, matches }, { headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300" } });
  } catch (e) { log.error("fixtures unavailable", { date, message: (e as Error).message }); return NextResponse.json({ error: "Match data is temporarily unavailable" }, { status: 503 }); }
}
