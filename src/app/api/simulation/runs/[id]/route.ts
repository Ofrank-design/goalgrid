import { NextResponse } from "next/server";
import { z } from "zod";
import { LABELS, NOTICE, proGate } from "@/lib/simulation/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
/** One stored run, exactly as it was produced. Never recomputed. */
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const g = await proGate(); if (g instanceof NextResponse) return g; const { id } = await ctx.params; if (!z.string().uuid().safeParse(id).success) return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  const { data } = await supabaseAdmin().from("simulation_runs").select("*").eq("id", id).eq("user_id", g.id).maybeSingle(); return data ? NextResponse.json({ labels: LABELS, notice: NOTICE, run: data }) : NextResponse.json({ error: "Not found" }, { status: 404 });
}
