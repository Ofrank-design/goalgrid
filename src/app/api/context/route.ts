import { NextResponse } from "next/server";
import { z } from "zod";
import { getFixtures } from "@/lib/engine/ingestion/fixtures";
import { getMatchContext } from "@/lib/engine/ingestion/context";
import { log } from "@/lib/logging/logger";
import { currentTier, hasTier } from "@/lib/entitlements";
const q = z.object({ date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), id: z.string().regex(/^(sm|fd):\d+$/) });
export async function GET(req: Request) {
  const sp = new URL(req.url).searchParams, p = q.safeParse({ date: sp.get("date"), id: sp.get("id") });
  if (!p.success) return NextResponse.json({ error: "date (YYYY-MM-DD) and id (sm:123 or fd:123) are required" }, { status: 400 });
  try {
    const match = (await getFixtures(p.data.date)).matches.find(m => m.id === p.data.id);
    if (!match) return NextResponse.json({ error: "Match not found" }, { status: 404 });
    const ctx = await getMatchContext(match), pro = hasTier(await currentTier().catch(() => "free" as const), "pro");
    return NextResponse.json({ matchId: match.id, context: pro ? ctx : { ...ctx, market: null } }, { headers: { "Cache-Control": "private, max-age=120" } });
  } catch (e) { log.error("context unavailable", { message: (e as Error).message }); return NextResponse.json({ error: "Context is temporarily unavailable" }, { status: 503 }); }
}
