import Link from "next/link";
import { notFound } from "next/navigation";

import { ControlPlaneActions } from "@/components/ControlPlaneActions";
import { controlPlaneSnapshot } from "@/lib/control";
import { getAdmin } from "@/lib/ops/admin";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export default async function ControlPlanePage() {
  if (!(await getAdmin())) {
    notFound();
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

  return (
    <>
      <div className="row">
        <div>
          <h1>Control Plane</h1>
          <p className="sub">
            Governance, resource limits, model metadata and provider health.
          </p>
          <ControlPlaneActions />
        </div>
        <Link className="btn sm" href="/admin">
          Operations
        </Link>
      </div>

      <h2>Resource limits</h2>
      <div className="card scroll">
        <table>
          <thead>
            <tr>
              <th>KEY</th>
              <th>MAX</th>
              <th>WINDOW</th>
              <th>SCOPE</th>
            </tr>
          </thead>
          <tbody>
            {(limits.data ?? []).map((limit) => (
              <tr key={limit.key}>
                <td>{limit.key}</td>
                <td>{limit.max_value}</td>
                <td>{limit.window_seconds ?? "—"}</td>
                <td>{limit.scope}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h2>Feature flags</h2>
      <div className="chips">
        {(flags.data ?? []).map((flag) => (
          <span className="chip" key={flag.key}>
            {flag.key} · {flag.enabled ? "on" : "off"}
          </span>
        ))}
      </div>

      <h2>Providers</h2>
      <div className="card scroll">
        <table>
          <thead>
            <tr>
              <th>PROVIDER</th>
              <th>STATUS</th>
              <th>LATENCY</th>
              <th>ERROR RATE</th>
              <th>LAST OK</th>
            </tr>
          </thead>
          <tbody>
            {(providers.data ?? []).map((provider) => (
              <tr key={provider.provider_id}>
                <td>{provider.name}</td>
                <td>{provider.status}</td>
                <td>{provider.latency_ms ?? "—"}</td>
                <td>{provider.error_rate ?? "—"}</td>
                <td>{provider.last_ok_at ?? "never"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h2>Model registry</h2>
      <div className="card scroll">
        <table>
          <thead>
            <tr>
              <th>MODEL</th>
              <th>TIER</th>
              <th>STATUS</th>
              <th>HEALTH</th>
              <th>CALIBRATION</th>
            </tr>
          </thead>
          <tbody>
            {(models.data ?? []).map((model) => (
              <tr key={model.model_id}>
                <td>
                  {model.name}
                  <div className="note">{model.version}</div>
                </td>
                <td>{model.tier}</td>
                <td>{model.status}</td>
                <td>{model.health_score ?? "—"}</td>
                <td>{model.calibration_score ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h2>AI budgets</h2>
      <div className="chips">
        {(budgets.data ?? []).map((budget) => (
          <span className="chip" key={budget.key}>
            {budget.key} · {budget.requests_per_hour}/h · {Number(
              budget.tokens_per_hour,
            ).toLocaleString()} tokens
          </span>
        ))}
      </div>

      <h2>Runtime policy</h2>
      <pre
        className="card scroll"
        style={{ whiteSpace: "pre-wrap", fontSize: 12 }}
      >
        {JSON.stringify(controlPlaneSnapshot(), null, 2)}
      </pre>
    </>
  );
}
