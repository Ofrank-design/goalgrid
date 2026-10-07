import { NextResponse } from "next/server";
import { z } from "zod";
import { toCsv } from "@/lib/lab/export";
import { LABELS, NOTICE, proGate } from "@/lib/simulation/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
/** GET /api/simulation/runs/[id]/export?format=csv|json (Premium). The stored run exactly as produced, with labels, seed and versions. */
export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const g = await proGate(); if (g instanceof NextResponse) return g; if (g.tier !== "premium") return NextResponse.json({ error: "Exports needs a free account. Sign in to use it." }, { status: 403 }); const { id } = await ctx.params; if (!z.string().uuid().safeParse(id).success) return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  const { data: r } = await supabaseAdmin().from("simulation_runs").select("*").eq("id", id).eq("user_id", g.id).maybeSingle(); if (!r) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const fmt = new URL(req.url).searchParams.get("format") === "json" ? "json" : "csv", name = `simulation-${r.kind}-${r.seed}-${r.engine_version}`, head = { "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" };
  if (fmt === "json") return new NextResponse(JSON.stringify({ labels: LABELS, notice: NOTICE, run: r }, null, 2), { headers: { ...head, "Content-Type": "application/json", "Content-Disposition": `attachment; filename="${name}.json"` } });
  const ev = (r.events ?? []) as { seq: number; label: string; type: string; team: string | null; score: { home: number; away: number } }[], body = ev.length ? toCsv(["seq", "minute", "event", "team", "home", "away"], ev.map(e => [e.seq, e.label, e.type, e.team, e.score.home, e.score.away])) : toCsv(["key", "value"], Object.entries(r.result as Record<string, unknown>).map(([k, v]) => [k, typeof v === "object" ? JSON.stringify(v) : v]));
  return new NextResponse(`# ${NOTICE}\r\n# ${LABELS.join(" | ")}\r\n# run ${r.id} | kind ${r.kind} | seed ${r.seed} | engine ${r.engine_version} | model ${r.model_version}\r\n${body}`, { headers: { ...head, "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="${name}.csv"` } });
}
