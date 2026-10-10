import { formatPercent } from "./format";
import { MatchPlayer } from "../MatchPlayer";
import type { SimRun } from "./types";
import type { SimLabView } from "./useSimLab";

export function MatchResult({ v, simulation }: { v: SimLabView, simulation: SimRun }) {
  const { premium, initial, home, away, busy, playedRuns, runSimulation } = v;
  const homeSlug = initial && simulation === initial.sim ? initial.home : home;
  const awaySlug = initial && simulation === initial.sim ? initial.away : away;
  return (
    <>
    <div className="card" style={{ display: "grid", gap: 6 }}>
      <div className="meta">
        <span>Seed {simulation.seed}</span>
        <span>
          Baseline: {formatPercent(simulation.baseline.home, 0)} /{" "}
          {formatPercent(simulation.baseline.draw, 0)} /{" "}
          {formatPercent(simulation.baseline.away, 0)}
        </span>
        {simulation.applied.length > 0 && (
          <span>
            Scenario: {formatPercent(simulation.scenario.home, 0)} /{" "}
            {formatPercent(simulation.scenario.draw, 0)} /{" "}
            {formatPercent(simulation.scenario.away, 0)}
          </span>
        )}
        <span>
          Expected goals {simulation.scenario.xgHome} –{" "}
          {simulation.scenario.xgAway}
        </span>
      </div>

      <div className="chips" style={{ alignItems: "center" }}>
        <button
          className="chip"
          type="button"
          disabled={busy}
          onClick={() => void runSimulation(simulation.seed)}
        >
          Reproduce with seed {simulation.seed}
        </button>

        {premium && simulation.id && (
          <>
            <a
              className="chip"
              href={`/api/simulation/runs/${simulation.id}/export?format=csv`}
            >
              Export CSV
            </a>
            <a
              className="chip"
              href={`/api/simulation/runs/${simulation.id}/export?format=json`}
            >
              Export JSON
            </a>
            <a
              className="chip"
              href={`/simulation/report/${simulation.id}`}
            >
              Open report
            </a>
          </>
        )}
      </div>

      {initial &&
        simulation === initial.sim &&
        initial.engineVersion !== initial.currentEngine && (
          <p className="note">
            Stored by engine {initial.engineVersion}; the current engine is{" "}
            {initial.currentEngine}. Replay shows the stored match exactly;
            rerunning the seed may differ.
          </p>
        )}

      <p className="note">
        The same seed, settings and engine version reproduce this exact
        match. It is stored in your simulation history.
      </p>
    </div>

    <MatchPlayer
      key={`${simulation.id ?? simulation.seed}:${playedRuns}`}
      sim={{ ...simulation, baseline: simulation.baseline }}
      homeSlug={homeSlug}
      awaySlug={awaySlug}
      homeCrest={v.crests[homeSlug]}
      awayCrest={v.crests[awaySlug]}
    />
    </>
  );
}
