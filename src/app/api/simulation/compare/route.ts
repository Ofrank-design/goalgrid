import { NextResponse } from "next/server";
import { z } from "zod";
import { modelOutputs } from "@/lib/engine/predictions";
import { LEAGUES, leagueTeams, proGate, acquireSimulationSlot, releaseSimulationSlot } from "@/lib/simulation/server";
import { LIMIT_MESSAGE, allow } from "@/lib/security/limits";
const q = z.object({ league: z.enum(LEAGUES), home: z.string().regex(/^[a-z0-9-]{2,60}$/), away: z.string().regex(/^[a-z0-9-]{2,60}$/) });
/** GET /api/simulation/compare (Premium). Every model's own 1X2, goal markets and expected goals for a matchup, with how far apart they are. Read only: the lab never changes models. */
export async function GET(req: Request) {
  const g = await proGate(); if (g instanceof NextResponse) return g; if (g.tier !== "premium") return NextResponse.json({ error: "Model comparison needs a free account. Sign in to use it." }, { status: 403 });
  const p = q.safeParse(Object.fromEntries(new URL(req.url).searchParams)); if (!p.success || p.data.home === p.data.away) return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  if (!(await allow(g.id, "compare"))) return NextResponse.json({ error: LIMIT_MESSAGE }, { status: 429 });
  const slot = await acquireSimulationSlot(g.id, "compare"); if (!slot.slotId) return NextResponse.json({ error: slot.error ?? "Simulation capacity is busy." }, { status: 429 });
  try { const t = await leagueTeams(p.data.league); if (!t.includes(p.data.home) || !t.includes(p.data.away)) return NextResponse.json({ error: "Both teams must belong to the chosen league." }, { status: 400 });
    const { rows, abstained } = await modelOutputs(p.data.league, p.data.home, p.data.away); if (rows.length < 3) return NextResponse.json({ message: "Not enough data to compare models for this match." });
    const r3 = (x: number) => Math.round(x * 1000) / 1000, sd = (k: "home" | "draw" | "away") => { const m = rows.reduce((a, r) => a + r[k], 0) / rows.length; return Math.sqrt(rows.reduce((a, r) => a + (r[k] - m) ** 2, 0) / rows.length); };
    return NextResponse.json({ models: rows.map(r => ({ ...r, weight: r3(r.weight), home: r3(r.home), draw: r3(r.draw), away: r3(r.away), btts: r.btts == null ? null : r3(r.btts), over25: r.over25 == null ? null : r3(r.over25) })).sort((a, b) => b.weight - a.weight), abstained, spread: { home: r3(sd("home")), draw: r3(sd("draw")), away: r3(sd("away")) }, note: "Each model's view of this matchup. Wide spread means the models disagree and the headline number deserves less trust." }, { headers: { "Cache-Control": "private, max-age=120" } });
  } catch { return NextResponse.json({ error: "Model comparison is temporarily unavailable" }, { status: 503 }); } finally { await releaseSimulationSlot(slot.slotId); }
}
