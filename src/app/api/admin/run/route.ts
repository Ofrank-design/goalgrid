import { NextResponse } from "next/server";
import { z } from "zod";
import { getAdmin } from "@/lib/ops/admin";
import { digestJob, evaluateJob, refreshJob } from "@/lib/ops/jobs";
import { LIMIT_MESSAGE, allow } from "@/lib/security/limits";
import { serverError } from "@/lib/security/errors";
export const maxDuration = 60;
export async function POST(req: Request) {
  const admin = await getAdmin(); if (!admin) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!(await allow(admin.id, "adminHeavy"))) return NextResponse.json({ error: LIMIT_MESSAGE }, { status: 429 });
  const p = z.object({ job: z.enum(["refresh", "evaluate", "digest-test"]) }).safeParse(await req.json().catch(() => null)); if (!p.success) return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  try { return NextResponse.json(p.data.job === "refresh" ? await refreshJob() : p.data.job === "evaluate" ? await evaluateJob() : await digestJob({ only: admin.email })); }
  catch (e) { return serverError("admin job failed", e, 500, "The job failed. Check the server logs."); }
}
