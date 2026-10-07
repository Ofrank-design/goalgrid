import "server-only";
import { log } from "@/lib/logging/logger";
import { settleDue } from "@/lib/community/settle";
import { digestJob, evaluateJob, maintenanceJob, notificationDeliveryJob, weeklyChallengeJob } from "./jobs";

/**
 * Everything that is not the heavy model refresh, in one run, for hosts where cron can fire only once a day (Vercel Hobby allows two jobs, once each).
 * Steps run in order of importance and one failing never stops the rest. A time budget keeps the whole run inside the function limit; a step that does not
 * fit is reported as skipped and happens on the next run.
 */
export async function dailyJob(budgetMs = 45_000) {
  const started = Date.now(), out: Record<string, unknown> = {};
  const steps: [string, () => Promise<unknown>][] = [
    ["digest", () => digestJob()],
    ["notifications", () => notificationDeliveryJob()],
    ["evaluate", async () => ({ ...(await evaluateJob()), settledPicks: await settleDue() })],
    ["challenge", () => weeklyChallengeJob()],
    ["maintenance", () => maintenanceJob()],
  ];
  for (const [name, run] of steps) {
    if (Date.now() - started > budgetMs) { out[name] = { skipped: "time budget" }; continue; }
    try { out[name] = await run(); } catch (e) { log.error("daily step failed", { step: name, message: e instanceof Error ? e.message : String(e) }); out[name] = { error: "failed" }; }
  }
  return { ...out, ms: Date.now() - started };
}
