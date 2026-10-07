import { LEAGUES, formatLabel } from "./format";
import type { SimLabView } from "./useSimLab";

export function SetupCard({ v }: { v: SimLabView }) {
  const { maxRuns, league, setLeague, teams, presets, home, setHome, away, setAway, chosenScenarios, setChosenScenarios, seed, setSeed, message, busy, runSimulation, runMultipleSimulations } = v;
  return (
    <div className="card" style={{ display: "grid", gap: 10 }}>
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        <label>
          Competition
          <select value={league} onChange={(event) => setLeague(event.target.value)}>
            {LEAGUES.map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>

        <label>
          Home
          <select value={home} onChange={(event) => setHome(event.target.value)}>
            {teams.map((team) => (
              <option key={team} value={team}>
                {formatLabel(team)}
              </option>
            ))}
          </select>
        </label>

        <label>
          Away
          <select value={away} onChange={(event) => setAway(event.target.value)}>
            {teams.map((team) => (
              <option key={team} value={team}>
                {formatLabel(team)}
              </option>
            ))}
          </select>
        </label>

        <label>
          Seed (optional)
          <input
            className="in"
            value={seed}
            maxLength={16}
            placeholder="8F2A91D7"
            onChange={(event) =>
              setSeed(event.target.value.replace(/[^A-Za-z0-9]/g, ""))
            }
          />
        </label>
      </div>

      <fieldset style={{ border: 0, padding: 0 }}>
        <legend className="note">
          Scenario (optional). Assumption sizes are illustrative, not player
          measurements.
        </legend>
        <div className="chips">
          {presets.map((preset) => {
            const selected = chosenScenarios.includes(preset.id);

            return (
              <button
                key={preset.id}
                type="button"
                className={`chip ${selected ? "on" : ""}`}
                aria-pressed={selected}
                title={preset.note}
                onClick={() =>
                  setChosenScenarios((current) =>
                    current.includes(preset.id)
                      ? current.filter((id) => id !== preset.id)
                      : current.length < 6
                        ? [...current, preset.id]
                        : current,
                  )
                }
              >
                {preset.label}
                {preset.kind === "assumption" ? " *" : ""}
              </button>
            );
          })}
        </div>
      </fieldset>

      <div className="chips" style={{ alignItems: "center" }}>
        <button
          className="btn p"
          type="button"
          disabled={busy || !home || !away || home === away}
          onClick={() => void runSimulation()}
        >
          {busy ? "Running…" : "Run simulation"}
        </button>

        {[10, 100, 1000].map((runs) => (
          <button
            key={runs}
            className="chip"
            type="button"
            disabled={busy || !home || !away || home === away || runs > maxRuns}
            title={runs > maxRuns ? "Higher limits needs a free account. Sign in to use it." : undefined}
            onClick={() => void runMultipleSimulations(runs)}
          >
            {runs.toLocaleString("en")} runs
          </button>
        ))}
      </div>

      {message && (
        <p className="note" role="alert">
          {message}
        </p>
      )}
    </div>
  );
}
