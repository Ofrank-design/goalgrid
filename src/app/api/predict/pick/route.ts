import { NextResponse } from "next/server";
import { z } from "zod";
import { fail, requireMember } from "@/lib/community/api";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { awardFor } from "@/lib/community/awards";
import { LIMIT_MESSAGE, allow } from "@/lib/security/limits";
import { getFixtures } from "@/lib/engine/ingestion/fixtures";
const schema = z.object({ matchId: z.string().regex(/^(sm|fd):\d+$/), date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), pick: z.enum(["home", "draw", "away"]), confidence: z.number().int().min(40).max(95) });
/** One pick per match per user, changeable until kickoff. The server checks the kickoff time, not the browser. */
export async function POST(req: Request) {
  const me = await requireMember(); if (me instanceof NextResponse) return me;
  if (!(await allow(me.id, "prediction"))) return fail(LIMIT_MESSAGE, 429);
  const p = schema.safeParse(await req.json().catch(() => null)); if (!p.success) return fail("Invalid pick.", 400);
  let match; try { match = (await getFixtures(p.data.date)).matches.find(m => m.id === p.data.matchId); } catch { return fail("Match data is unavailable right now.", 503); }
  if (!match) return fail("Match not found.", 404);
  if (match.status !== "scheduled" || Date.parse(match.kickoffUtc) < Date.now() + 60_000) return fail("Picks are closed for this match.", 409);
  const { error } = await supabaseAdmin().from("user_predictions").upsert({ user_id: me.id, match_id: match.id, match_date: p.data.date, league_slug: match.league.slug, home_name: match.home.name, away_name: match.away.name, kickoff_utc: match.kickoffUtc, pick: p.data.pick, confidence: p.data.confidence, updated_at: new Date().toISOString() }, { onConflict: "user_id,match_id" });
  if (error) return fail("Could not save your pick.", 500);
  void awardFor(me.id);
  return NextResponse.json({ saved: true });
}
