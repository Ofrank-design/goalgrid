import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/community/api";
import { ensurePreferences } from "@/lib/notifications/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { LIMIT_MESSAGE, allow } from "@/lib/security/limits";

const schema = z.object({
  in_app: z.boolean().optional(), email: z.boolean().optional(), push: z.boolean().optional(),
  prediction: z.boolean().optional(), match: z.boolean().optional(), simulation: z.boolean().optional(),
  challenge: z.boolean().optional(), community: z.boolean().optional(), follow: z.boolean().optional(),
  like: z.boolean().optional(), comment: z.boolean().optional(), system: z.boolean().optional(), security: z.boolean().optional()
});
export async function GET() { const u = await requireUser(); if (!u) return NextResponse.json({ error: "Sign in first." }, { status: 401 }); return NextResponse.json({ preferences: await ensurePreferences(u.id) }); }
export async function PATCH(req: Request) {
  const u = await requireUser(); if (!u) return NextResponse.json({ error: "Sign in first." }, { status: 401 });
  if (!(await allow(u.id, "notifPrefs"))) return NextResponse.json({ error: LIMIT_MESSAGE }, { status: 429 });
  const p = schema.safeParse(await req.json().catch(() => null)); if (!p.success) return NextResponse.json({ error: "Invalid preferences." }, { status: 400 });
  const db = supabaseAdmin(); const next = { ...(p.data as Record<string, boolean>), security: true, in_app: p.data.in_app ?? true }; const { data, error } = await db.from("notification_preferences").upsert({ user_id: u.id, ...next }, { onConflict: "user_id" }).select("*").single();
  if (error) return NextResponse.json({ error: "Could not save preferences." }, { status: 500 }); return NextResponse.json({ preferences: data });
}
