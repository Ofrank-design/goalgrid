import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { safeNext } from "@/lib/app/format";
export async function GET(req: Request) {
  const url = new URL(req.url), code = url.searchParams.get("code"), next = safeNext(url.searchParams.get("next"));
  if (code) await (await supabaseServer()).auth.exchangeCodeForSession(code);
  return NextResponse.redirect(new URL(next, url.origin));
}
