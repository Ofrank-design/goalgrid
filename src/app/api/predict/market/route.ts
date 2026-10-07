import { NextResponse } from "next/server";
import { z } from "zod";
import { fail, requireMember } from "@/lib/community/api";
import { marketPick } from "@/lib/community/markets";
import { LIMIT_MESSAGE, allow } from "@/lib/security/limits";
import { getFixtures } from "@/lib/engine/ingestion/fixtures";
import { supabaseAdmin } from "@/lib/supabase/admin";
const base = z.object({ matchId: z.string().regex(/^(sm|fd):\d+$/), date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/) });
/** One pick per match per market, changeable until kickoff. Points, correctness and settlement time are written only by the server job. */
export async function POST(req: Request) {
  const me = await requireMember(); if (me instanceof NextResponse) return me; if (!(await allow(me.id, "prediction"))) return fail(LIMIT_MESSAGE, 429);
  const raw = await req.json().catch(() => null), b = base.safeParse(raw), m = marketPick.safeParse(raw); if (!b.success || !m.success) return fail("Invalid pick.", 400);
  let match; try { match = (await getFixtures(b.data.date)).matches.find(x => x.id === b.data.matchId); } catch { return fail("Match data is unavailable right now.", 503); }
  if (!match) return fail("Match not found.", 404); if (match.status !== "scheduled" || Date.parse(match.kickoffUtc) < Date.now() + 60_000) return fail("Picks are closed for this match.", 409);
  const { error } = await supabaseAdmin().from("user_market_picks").upsert({ user_id: me.id, match_id: match.id, market: m.data.market, value: m.data.value, match_date: b.data.date, kickoff_utc: match.kickoffUtc, updated_at: new Date().toISOString() }, { onConflict: "user_id,match_id,market" });
  return error ? fail("Could not save your pick.", 500) : NextResponse.json({ saved: true });
}
