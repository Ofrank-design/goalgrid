import { NextResponse } from "next/server";
import { digestJob, evaluateJob, refreshJob, notificationDeliveryJob, maintenanceJob, weeklyChallengeJob } from "@/lib/ops/jobs";
import { dailyJob } from "@/lib/ops/daily";
import { settleDue } from "@/lib/community/settle";
import { bearerOk } from "@/lib/security/bearer";
import { serverError } from "@/lib/security/errors";
export const maxDuration = 60;
/** Scheduled by Vercel Cron (see vercel.json). Requires the CRON_SECRET bearer token. */
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET; if (!secret || !bearerOk(req.headers.get("authorization"), secret)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const job = new URL(req.url).searchParams.get("job");
  try {
    if (job === "refresh") return NextResponse.json(await refreshJob());
    if (job === "evaluate") return NextResponse.json({ ...(await evaluateJob()), settledPicks: await settleDue() });
    if (job === "digest") return NextResponse.json(await digestJob());
    if (job === "notifications") return NextResponse.json(await notificationDeliveryJob());
    if (job === "challenge") return NextResponse.json(await weeklyChallengeJob());
    if (job === "daily") return NextResponse.json(await dailyJob());
    if (job === "maintenance") return NextResponse.json(await maintenanceJob());
    return NextResponse.json({ error: "job must be refresh, daily, evaluate, digest, notifications, challenge or maintenance" }, { status: 400 });
  } catch (e) { return serverError(`cron job "${job}" failed`, e, 500, "The job failed. Check the server logs."); }
}
