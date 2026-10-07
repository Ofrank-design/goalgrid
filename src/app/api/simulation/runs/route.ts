import { NextResponse } from "next/server";
import { proGate } from "@/lib/simulation/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
export async function GET() {
  const g = await proGate(); if (g instanceof NextResponse) return g;
  const { data } = await supabaseAdmin().from("simulation_runs").select("id,kind,league_slug,configuration,seed,engine_version,record_count,created_at").eq("user_id", g.id).order("created_at", { ascending: false }).limit(50); return NextResponse.json({ runs: data ?? [] });
}
