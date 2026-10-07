import "server-only";
import { after } from "next/server";

/** Runs a task after the response has been sent, so serverless hosts keep the function alive for it. Outside a request (cron, scripts) it simply runs. */
export function background(task: () => Promise<unknown>): void {
  try { after(task); } catch { void task().catch(() => undefined); }
}
