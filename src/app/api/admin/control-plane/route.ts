import { NextResponse } from "next/server";

import { controlPlaneSnapshot } from "@/lib/control";
import { syncControlPlane } from "@/lib/control/sync";
import { getAdmin } from "@/lib/ops/admin";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { LIMIT_MESSAGE, allow } from "@/lib/security/limits";

export async function POST() {
  const admin = await getAdmin();
  if (!admin) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (!(await allow(admin.id, "adminHeavy"))) return NextResponse.json({ error: LIMIT_MESSAGE }, { status: 429 });

  return NextResponse.json(await syncControlPlane());
}

export async function GET() {
  if (!(await getAdmin())) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const db = supabaseAdmin();

  const [flags, limits, models, providers, budgets] = await Promise.all([
    db.from("feature_flags").select("*").order("key"),
    db.from("resource_limits").select("*").order("key"),
    db
      .from("model_registry")
      .select(
        "model_id,name,version,status,tier,health_score,calibration_score,compute_cost,latency_cost,supported_competitions",
      )
      .order("tier")
      .order("name")
      .limit(200),
    db
      .from("provider_registry")
      .select(
        "provider_id,name,kind,status,latency_ms,error_rate,last_ok_at",
      )
      .order("provider_id"),
    db.from("ai_budget_profiles").select("*").order("key"),
  ]);

  return NextResponse.json({
    snapshot: controlPlaneSnapshot(),
    flags: flags.data ?? [],
    limits: limits.data ?? [],
    models: models.data ?? [],
    providers: providers.data ?? [],
    budgets: budgets.data ?? [],
  });
}
