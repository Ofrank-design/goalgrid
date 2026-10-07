import { NextResponse } from "next/server";
import { LEAGUES, leagueTeams, presetList, proGate } from "@/lib/simulation/server";
export async function GET(req: Request) {
  const g = await proGate(); if (g instanceof NextResponse) return g; const league = new URL(req.url).searchParams.get("league") as (typeof LEAGUES)[number];
  if (!LEAGUES.includes(league)) return NextResponse.json({ error: "Unknown league" }, { status: 400 });
  try { return NextResponse.json({ league, teams: await leagueTeams(league), presets: presetList }, { headers: { "Cache-Control": "private, max-age=300" } }); } catch { return NextResponse.json({ error: "Teams are temporarily unavailable" }, { status: 503 }); }
}
