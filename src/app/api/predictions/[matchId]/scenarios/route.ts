import { NextResponse } from "next/server";
import { z } from "zod";
import { scenarioBase } from "@/lib/engine/predictions";
import { PRESETS, compareSummaries, resolveScenarios, summarize, tiltMatrix } from "@/lib/engine/scenarios";
import { currentTier, hasTier } from "@/lib/entitlements";
export const maxDuration = 60;
const q = z.object({ date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), scenario: z.string().max(300).optional(), homeAttack: z.coerce.number().optional(), awayAttack: z.coerce.number().optional() });
/** GET /api/predictions/sm:123/scenarios?date=2026-10-10&scenario=home-striker-out,heavy-rain&homeAttack=0.95. Signed-in users only. Re-prices a real fixture under assumptions and shows baseline, scenario and the change in percentage points. Nothing here changes the real prediction. */
export async function GET(req: Request, ctx: { params: Promise<{ matchId: string }> }) {
  const tier = await currentTier().catch(() => "free" as const); if (!hasTier(tier, "premium")) return NextResponse.json({ error: "Scenario analysis needs a free account. Sign in to use it." }, { status: 403 });
  const { matchId } = await ctx.params, id = decodeURIComponent(matchId); if (!/^(sm|fd):\d+$/.test(id)) return NextResponse.json({ error: "Invalid match id" }, { status: 400 });
  const sp = Object.fromEntries(new URL(req.url).searchParams), p = q.safeParse(sp); if (!p.success) return NextResponse.json({ error: "date (YYYY-MM-DD) is required" }, { status: 400 });
  const ids = (p.data.scenario ?? "").split(",").map(s => s.trim()).filter(Boolean); if (ids.length > 6) return NextResponse.json({ error: "Choose up to 6 scenarios" }, { status: 400 });
  try {
    const b = await scenarioBase(p.data.date, id); if (!b) return NextResponse.json({ error: "Match not found" }, { status: 404 }); if (!b.matrix) return NextResponse.json({ message: "Not enough data to price this match", presets: PRESETS.map(({ id, label, kind }) => ({ id, label, kind })) }, { status: 200 });
    const base = summarize(b.matrix), r = resolveScenarios(ids, p.data.homeAttack != null || p.data.awayAttack != null ? { home: p.data.homeAttack, away: p.data.awayAttack } : null, base); if (!r.ok) return NextResponse.json({ error: r.error }, { status: 400 });
    const sc = summarize(tiltMatrix(b.matrix, r.mh, r.ma));
    return NextResponse.json({ match: { id: b.match.id, home: b.match.home.name, away: b.match.away.name, kickoffUtc: b.match.kickoffUtc }, baseline: base, scenario: sc, change: compareSummaries(base, sc), applied: r.applied, multipliers: { home: Math.round(r.mh * 1000) / 1000, away: Math.round(r.ma * 1000) / 1000 }, presets: PRESETS.map(({ id, label, kind }) => ({ id, label, kind })),
      note: "Scenarios re-price this match under assumptions. Sizes marked as assumptions are illustrative, not measured, and a scenario is not a forecast of what will happen." }, { headers: { "Cache-Control": "private, max-age=60" } });
  } catch { return NextResponse.json({ error: "Scenario analysis is temporarily unavailable" }, { status: 503 }); }
}
