import "server-only";
import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { GOALGRID_LIMITS } from "@/lib/control";
import { SlidingWindow } from "./ratelimit";
import { clientIp } from "./ip";

export const USER_LIMITS = {
  post: { max: GOALGRID_LIMITS.community.postsPerHour, windowSec: 3600 },
  booking: { max: 5, windowSec: 3600 },
  simulate: { max: 60, windowSec: 3600 },
  simSeason: { max: 10, windowSec: 3600 },
  ask: { max: GOALGRID_LIMITS.ai.requestsPerHour, windowSec: 3600 },
  note: { max: 30, windowSec: 86_400 },
  verify: { max: 30, windowSec: 3600 },
  comment: { max: GOALGRID_LIMITS.community.commentsPerHour, windowSec: 3600 },
  like: { max: GOALGRID_LIMITS.community.likesPerHour, windowSec: 3600 },
  report: { max: GOALGRID_LIMITS.community.reportsPerDay, windowSec: 86_400 },
  prediction: { max: 30, windowSec: 86_400 },
  profileEdit: { max: 2, windowSec: 3600 },
  proofUpload: { max: 5, windowSec: 86_400 },
  follow: { max: GOALGRID_LIMITS.community.followsPerHour, windowSec: 3600 },
  save: { max: 60, windowSec: 3600 },
  circle: { max: 60, windowSec: 3600 },
  remove: { max: 60, windowSec: 3600 },
  notifRead: { max: 240, windowSec: 3600 },
  notifPrefs: { max: 30, windowSec: 3600 },
  labRun: { max: 60, windowSec: 3600 },
  labImport: { max: 10, windowSec: 3600 },
  compare: { max: 20, windowSec: 3600 },
  adminAction: { max: 300, windowSec: 3600 },
  adminHeavy: { max: 12, windowSec: 3600 },
} as const;
export type LimitedAction = keyof typeof USER_LIMITS;
export const LIMIT_MESSAGE = "You have reached the current limit. Try again later.";

export async function allow(userId: string, action: LimitedAction): Promise<boolean> {
  const l = USER_LIMITS[action];
  try {
    const { data, error } = await supabaseAdmin().rpc("take_rate_limit", { p_key: `${action}:${userId}`, p_max: l.max, p_window_seconds: l.windowSec });
    if (error) throw error;
    return !!(data as { allowed: boolean }[])[0]?.allowed;
  } catch {
    // Fail closed for abuse-sensitive and expensive actions.
    return !["proofUpload", "report", "simulate", "simSeason", "ask", "compare", "labImport", "adminHeavy"].includes(action);
  }
}

export async function allowKey(key: string, max: number, windowSec: number): Promise<boolean> {
  try {
    const { data, error } = await supabaseAdmin().rpc("take_rate_limit", { p_key: key, p_max: max, p_window_seconds: windowSec });
    if (error) throw error;
    return !!(data as { allowed: boolean }[])[0]?.allowed;
  } catch {
    return false;
  }
}

/**
 * Shared counter in Postgres, so every server instance sees the same count. If the database call fails the limiter degrades to a
 * per-instance in-memory window instead of failing open, so a database outage never removes protection entirely.
 */
const local = new SlidingWindow();
export async function takeShared(key: string, max: number, windowSec: number): Promise<{ ok: boolean; retryAfterSec: number }> {
  try {
    const { data, error } = await supabaseAdmin().rpc("take_rate_limit", { p_key: key, p_max: max, p_window_seconds: windowSec });
    if (error) throw error;
    const row = (data as { allowed: boolean; retry_after_seconds: number }[])[0];
    return { ok: !!row?.allowed, retryAfterSec: row?.retry_after_seconds ?? 0 };
  } catch {
    return local.check(key, max, windowSec * 1000);
  }
}
/** Keys are hashed so the rate_events table never stores raw IP addresses or email addresses. */
const fingerprint = (value: string) => createHash("sha256").update(`${process.env.RATE_LIMIT_SALT ?? ""}|${value.toLowerCase()}`).digest("hex").slice(0, 20);
export const allowIp = (req: Request, bucket: string, max: number, windowSec: number) => takeShared(`ip:${bucket}:${fingerprint(clientIp(req.headers))}`, max, windowSec);
export const allowTarget = (bucket: string, target: string, max: number, windowSec: number) => takeShared(`target:${bucket}:${fingerprint(target)}`, max, windowSec);
export const tooMany = (message: string, retryAfterSec = 60) => NextResponse.json({ error: message }, { status: 429, headers: { "Retry-After": String(Math.max(1, retryAfterSec)) } });
