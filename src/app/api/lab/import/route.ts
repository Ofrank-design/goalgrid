import { NextResponse } from "next/server";
import { z } from "zod";
import { getAdmin } from "@/lib/ops/admin";
import { normalizeBatch } from "@/lib/lab/observations";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { LIMIT_MESSAGE, allow } from "@/lib/security/limits";
const body = z.object({ gameId: z.string().regex(/^[a-z0-9-]{2,40}$/), sourceId: z.string().regex(/^[a-z0-9-]{2,40}$/), rows: z.array(z.unknown()).min(1).max(5000), quality: z.enum(["verified", "observed", "partial"]).optional() });
/** POST /api/lab/import. Admin only. Loads observations you are entitled to use (your own export or a licensed feed). The game and source must already exist. Duplicates are skipped, nothing is ever overwritten. */
export async function POST(req: Request) {
  const admin = await getAdmin(); if (!admin) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!(await allow(admin.id, "labImport"))) return NextResponse.json({ error: LIMIT_MESSAGE }, { status: 429 });
  const p = body.safeParse(await req.json().catch(() => null)); if (!p.success) return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  const db = supabaseAdmin(), { data: src } = await db.from("game_sources").select("id").eq("id", p.data.sourceId).eq("game_id", p.data.gameId).maybeSingle(); if (!src) return NextResponse.json({ error: "Unknown game or source" }, { status: 404 });
  const r = normalizeBatch(p.data.rows, { gameId: p.data.gameId, sourceId: p.data.sourceId, quality: p.data.quality });
  if (r.accepted.length) { const { error } = await db.from("game_observations").upsert(r.accepted.map(o => ({ game_id: o.gameId, source_id: o.sourceId, external_round_id: o.externalRoundId, observed_at: o.observedAt, value: o.value, raw_value: o.rawValue, sequence: o.sequence, data_quality: o.dataQuality })), { ignoreDuplicates: true });
    if (error) return NextResponse.json({ error: "Could not store observations" }, { status: 500 }); await db.from("collection_health").upsert({ source_id: p.data.sourceId, last_success_at: new Date().toISOString(), updated_at: new Date().toISOString() }); }
  return NextResponse.json({ accepted: r.accepted.length, rejected: r.rejected.slice(0, 20), rejectedCount: r.rejected.length, duplicatesInBatch: r.duplicatesInBatch });
}
