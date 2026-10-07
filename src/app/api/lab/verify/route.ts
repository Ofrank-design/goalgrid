import { NextResponse } from "next/server";
import { z } from "zod";
import { getViewer } from "@/lib/app/session";
import { requireUser } from "@/lib/community/api";
import { hasTier } from "@/lib/entitlements";
import { verify } from "@/lib/lab/verify";
import { LIMIT_MESSAGE, allow } from "@/lib/security/limits";
const body = z.object({ sourceId: z.string().regex(/^[a-z0-9-]{2,40}$/), inputs: z.record(z.string().max(200)).refine(o => Object.keys(o).length <= 8), expected: z.string().max(200) });
/** POST /api/lab/verify. Signed-in users only. Checks published inputs against a documented scheme for the source, or says verification is unavailable. */
export async function POST(req: Request) {
  const v = await getViewer(), u = await requireUser(); if (!u || !hasTier(v.tier, "premium")) return NextResponse.json({ error: "Verification needs a free account. Sign in to use it." }, { status: 403 });
  const p = body.safeParse(await req.json().catch(() => null)); if (!p.success) return NextResponse.json({ error: "Invalid request" }, { status: 400 }); if (!(await allow(u.id, "verify"))) return NextResponse.json({ error: LIMIT_MESSAGE }, { status: 429 });
  return NextResponse.json(verify(p.data.sourceId, p.data.inputs, p.data.expected));
}
