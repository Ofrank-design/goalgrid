import "server-only";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { GOALGRID_LIMITS } from "@/lib/control";

/** Deletes synthetic simulation runs older than the retention window, in bounded batches (up to 20 x 500 per call) until none are left. */
export async function purgeExpiredRuns() {
  const before = new Date(Date.now() - GOALGRID_LIMITS.simulation.retentionDays * 86_400_000).toISOString();
  const db = supabaseAdmin();
  let deleted = 0;
  for (let batch = 0; batch < 20; batch++) {
    const { data: rows } = await db.from("simulation_runs").select("id").lt("created_at", before).limit(500);
    if (!rows?.length) break;
    const { error } = await db.from("simulation_runs").delete().in("id", rows.map(r => r.id as string));
    if (error) throw new Error(error.message);
    deleted += rows.length;
    if (rows.length < 500) break;
  }
  return { deleted, before };
}
