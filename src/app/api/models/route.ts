import { NextResponse } from "next/server";
import { z } from "zod";
import { getLeagueModels } from "@/lib/engine/predictions";
import { currentTier, hasTier } from "@/lib/entitlements";
import { log } from "@/lib/logging/logger";
export const maxDuration = 60;
const q = z.object({ league: z.enum(["premier-league", "la-liga", "serie-a", "bundesliga", "ligue-1"]) });
/** GET /api/models?league=premier-league. The model library with measured status, held out log loss and weights. Signed-in users only. */
export async function GET(req: Request) {
  const p = q.safeParse({ league: new URL(req.url).searchParams.get("league") });
  if (!p.success) return NextResponse.json({ error: "league is required" }, { status: 400 });
  const tier = await currentTier().catch(() => "free" as const);
  if (!hasTier(tier, "pro")) return NextResponse.json({ error: "The model library needs a free account. Sign in to use it." }, { status: 403 });
  try { return NextResponse.json(await getLeagueModels(p.data.league), { headers: { "Cache-Control": "private, max-age=300" } }); }
  catch (e) { log.error("model library failed", { message: (e as Error).message }); return NextResponse.json({ error: "The model library is temporarily unavailable" }, { status: 503 }); }
}
