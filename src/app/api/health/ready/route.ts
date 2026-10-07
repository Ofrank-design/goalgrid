import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { bearerOk } from "@/lib/security/bearer";
/** Readiness for uptime monitors: needs the CRON_SECRET bearer token. Reports whether the database answers and which providers are configured, never any value. */
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET; if (!secret || !bearerOk(req.headers.get("authorization"), secret)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const t = Date.now(); let db = false; try { const { error } = await supabaseAdmin().from("profiles").select("id", { head: true, count: "exact" }).limit(1); db = !error; } catch { db = false; }
  const set = (k: string) => Boolean(process.env[k]);
  return NextResponse.json({ ok: db, database: { ok: db, ms: Date.now() - t }, configured: { sportmonks: set("SPORTMONKS_API_KEY"), footballData: set("FOOTBALL_DATA_API_KEY"), odds: set("THE_ODDS_API_KEY") || set("ODDSPAPI_API_KEY"), email: set("RESEND_API_KEY"), llm: ["GROQ_API_KEY", "ANTHROPIC_API_KEY", "OPENROUTER_API_KEY", "GEMINI_API_KEY", "NVIDIA_API_KEY"].filter(set).length } }, { status: db ? 200 : 503 });
}
