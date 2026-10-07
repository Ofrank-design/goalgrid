import { NextResponse } from "next/server";
import { z } from "zod";
import { getViewer } from "@/lib/app/session";
import { hasTier } from "@/lib/entitlements";
import { loadSeries } from "@/lib/lab/data";
import { compare } from "@/lib/lab/stats";
const side = z.object({ game: z.string().regex(/^[a-z0-9-]{2,40}$/), source: z.string().regex(/^[a-z0-9-]{2,40}$/) });
const q = z.object({ a: side, b: side, range: z.enum(["1H", "24H", "7D", "30D", "ALL"]).default("7D") });
/** GET /api/lab/compare?aGame=..&aSource=..&bGame=..&bSource=..&range=7D. Compares two stored series (two sources of one game, or two games). Signed-in users only. */
export async function GET(req: Request) {
  const v = await getViewer(); if (!hasTier(v.tier, "premium")) return NextResponse.json({ error: "Comparison needs a free account. Sign in to use it." }, { status: 403 });
  const g = new URL(req.url).searchParams, p = q.safeParse({ a: { game: g.get("aGame"), source: g.get("aSource") }, b: { game: g.get("bGame"), source: g.get("bSource") }, range: g.get("range") ?? undefined }); if (!p.success) return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  try { const [a, b] = await Promise.all([loadSeries(p.data.a.game, p.data.a.source, p.data.range), loadSeries(p.data.b.game, p.data.b.source, p.data.range)]); if (!a.values.length || !b.values.length) return NextResponse.json({ message: "No data available for one of the series" }, { status: 404 });
    return NextResponse.json({ range: p.data.range, a: { ...p.data.a, observations: a.values.length }, b: { ...p.data.b, observations: b.values.length }, result: compare(a.values, b.values), note: "A difference describes these samples. It does not show that either source is wrong or that outcomes can be forecast." });
  } catch { return NextResponse.json({ error: "Comparison is temporarily unavailable" }, { status: 503 }); }
}
