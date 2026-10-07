import { NextResponse } from "next/server";
import { z } from "zod";
import { getAdmin } from "@/lib/ops/admin";
import { requireUser } from "@/lib/community/api";
import { getHistory } from "@/lib/engine/ingestion/history";
import { walkForwardBacktest } from "@/lib/engine/evaluation/backtest";
import { ALL_MODELS } from "@/lib/engine/models/ensemble";
import { LEAGUES } from "@/lib/simulation/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { LIMIT_MESSAGE, allow } from "@/lib/security/limits";
import { serverError } from "@/lib/security/errors";

export const maxDuration = 60;
const schema = z.object({ league: z.enum(LEAGUES), folds: z.number().int().min(2).max(6).default(4), startFraction: z.number().gt(0).lt(1).default(0.5), modelIds: z.array(z.string().min(1).max(80)).max(30).default([]) });

export async function GET() {
  if (!(await getAdmin())) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const { data } = await supabaseAdmin().from("backtest_runs").select("id,league_slug,folds,start_fraction,model_ids,result,created_at").order("created_at", { ascending: false }).limit(30);
  return NextResponse.json({ runs: data ?? [] });
}

export async function POST(req: Request) {
  const admin = await getAdmin(); if (!admin) return NextResponse.json({ error: "Not found" }, { status: 404 }); const user = await requireUser(); if (!user) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!(await allow(admin.id, "adminHeavy"))) return NextResponse.json({ error: LIMIT_MESSAGE }, { status: 429 });
  const body = schema.safeParse(await req.json().catch(() => null)); if (!body.success) return NextResponse.json({ error: body.error.issues[0]?.message ?? "Invalid request" }, { status: 400 });
  try {
    const history = await getHistory(body.data.league);
    if (history.length < 160) return NextResponse.json({ error: `Need at least 160 historical matches; only ${history.length} are available.` }, { status: 400 });
    const requested = body.data.modelIds.length ? ALL_MODELS.filter(m => body.data.modelIds.includes(m.id)) : ALL_MODELS.slice(0, 15);
    if (requested.length < 3) return NextResponse.json({ error: "Select at least three known models." }, { status: 400 });
    const result = walkForwardBacktest(history, { folds: body.data.folds, startFraction: body.data.startFraction, models: requested });
    const { data: row, error } = await supabaseAdmin().from("backtest_runs").insert({ created_by: user.id, league_slug: body.data.league, folds: body.data.folds, start_fraction: body.data.startFraction, model_ids: requested.map(m => m.id), result }).select("id,created_at").single();
    if (error || !row) return serverError("backtest store failed", error ?? "no row returned", 500, "Could not store backtest.");
    return NextResponse.json({ id: row.id, createdAt: row.created_at, result }, { status: 201 });
  } catch (e) { return serverError("backtest failed", e, 503, "Backtest failed. Check the server logs."); }
}
