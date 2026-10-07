import "server-only";

import { supabaseAdmin } from "@/lib/supabase/admin";
import type { ProviderId } from "./types";

/** Health reporting is best-effort so a monitoring write can never break a user request. */
export async function recordHealth(
  provider: ProviderId,
  ok: boolean,
  latencyMs?: number,
  errorKind?: string,
) {
  try {
    const now = new Date().toISOString();

    await supabaseAdmin()
      .from("provider_health")
      .upsert({
        provider,
        status: ok ? "ok" : "down",
        latency_ms: latencyMs ?? null,
        last_error_kind: ok ? null : errorKind ?? "unknown",
        ...(ok ? { last_ok_at: now } : {}),
        updated_at: now,
      });
  } catch {
    // Monitoring must stay out of the critical request path.
  }
}
