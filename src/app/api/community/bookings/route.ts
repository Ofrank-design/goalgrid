import { NextResponse } from "next/server";
import { fail, requireMember } from "@/lib/community/api";
import { bookingInput, checkNote } from "@/lib/community/booking";
import { isNewAccount } from "@/lib/community/moderation";
import { parseBlocked } from "@/lib/community/rules";
import { LIMIT_MESSAGE, allow } from "@/lib/security/limits";
import { supabaseAdmin } from "@/lib/supabase/admin";
/** POST /api/community/bookings. The user id comes from the session. Verification and moderation fields cannot be sent: the schema has no place for them and the database defaults apply. */
export async function POST(req: Request) {
  const me = await requireMember(); if (me instanceof NextResponse) return me;
  if (isNewAccount(me.createdAt)) return fail("New accounts can share booking codes after the first day.", 403);
  if (!(await allow(me.id, "booking"))) return fail(LIMIT_MESSAGE, 429);
  const p = bookingInput.safeParse(await req.json().catch(() => null)); if (!p.success) return fail(p.error.issues[0]?.message ?? "Invalid request.", 400);
  const n = checkNote(p.data.note); if (!n.ok) return fail(n.error, 400);
  const blocked = parseBlocked(process.env.BLOCKED_TERMS), hay = `${p.data.bookingCode} ${n.text ?? ""} ${p.data.bookmaker ?? ""}`.toLowerCase(); if (blocked.some(t => hay.includes(t))) return fail("That breaks the community rules.", 400);
  const { data, error } = await supabaseAdmin().from("community_booking_posts").insert({ user_id: me.id, booking_code: p.data.bookingCode, bookmaker: p.data.bookmaker ?? null, match_id: p.data.matchId ?? null, odds: p.data.odds ?? null, note: n.text, visibility: p.data.visibility }).select("id").single();
  if (error) return fail(error.code === "23505" ? "You have already shared that code." : "Could not share. Try again.", error.code === "23505" ? 409 : 500);
  return NextResponse.json({ id: data.id }, { status: 201 });
}
