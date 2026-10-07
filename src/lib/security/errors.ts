import "server-only";
import { NextResponse } from "next/server";
import { log } from "@/lib/logging/logger";

/** Logs the real error for operators and returns a generic message, so database and provider internals never reach a response body. */
export function serverError(label: string, e: unknown, status = 500, publicMessage = "Something went wrong. Please try again.") {
  log.error(label, { message: e instanceof Error ? e.message : String(e) });
  return NextResponse.json({ error: publicMessage }, { status });
}
