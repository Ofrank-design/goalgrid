import { NextResponse } from "next/server";
import { LEAGUES, leagueTeams, presetList, proGate } from "@/lib/simulation/server";
import { getLeagueTeams } from "@/lib/football/teams";
import { crestOf } from "@/lib/football/teams-normalize";
export async function GET(req: Request) {
  const g = await proGate(); if (g instanceof NextResponse) return g; const league = new URL(req.url).searchParams.get("league") as (typeof LEAGUES)[number];
  if (!LEAGUES.includes(league)) return NextResponse.json({ error: "Unknown league" }, { status: 400 });
  try { const teams = await leagueTeams(league), stored = await getLeagueTeams(league, { cacheOnly: true }).catch(() => []), crests = Object.fromEntries(teams.flatMap((t: string) => { const c = crestOf(stored, t); return c ? [[t, c]] : []; })); return NextResponse.json({ league, teams, crests, presets: presetList }, { headers: { "Cache-Control": "private, max-age=300" } }); } catch { return NextResponse.json({ error: "Teams are temporarily unavailable" }, { status: 503 }); }
}
