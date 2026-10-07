import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/community/api";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { LIMIT_MESSAGE, allow } from "@/lib/security/limits";
const schema = z.object({ id: z.string().uuid().optional(), all: z.boolean().optional() });
export async function POST(req: Request) {
  const u = await requireUser(); if (!u) return NextResponse.json({ error: "Sign in first." }, { status: 401 });
  if (!(await allow(u.id, "notifRead"))) return NextResponse.json({ error: LIMIT_MESSAGE }, { status: 429 });
  const p = schema.safeParse(await req.json().catch(() => null)); if (!p.success || (!p.data.id && !p.data.all)) return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  const db = supabaseAdmin(); let q = db.from("notifications").update({ read_at: new Date().toISOString() }).eq("user_id", u.id).is("read_at", null);
  if (p.data.id) q = q.eq("id", p.data.id); const { error } = await q; if (error) return NextResponse.json({ error: "Could not update notification." }, { status: 500 }); return NextResponse.json({ ok: true });
}
