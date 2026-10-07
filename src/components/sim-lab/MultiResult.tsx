import { formatLabel, formatPercent } from "./format";
import type { MultiSimulation } from "./types";
import type { SimLabView } from "./useSimLab";

export function MultiResult({ v, multiSimulation }: { v: SimLabView, multiSimulation: MultiSimulation }) {
  const { home, away } = v;
  return (
    <div className="card" style={{ display: "grid", gap: 8 }}>
      <b>{multiSimulation.runs.toLocaleString("en")} simulated matches</b>

      <table>
        <thead>
          <tr>
            <th>OUTCOME</th>
            <th>COUNT</th>
            <th>SHARE</th>
            <th>± (95%)</th>
          </tr>
        </thead>
        <tbody>
          {(["home", "draw", "away"] as const).map((outcome) => {
            const label =
              outcome === "home"
                ? `${formatLabel(home)} win`
                : outcome === "away"
                  ? `${formatLabel(away)} win`
                  : "Draw";
            const data = multiSimulation[outcome];

            return (
              <tr key={outcome}>
                <td>{label}</td>
                <td className="n">{data.count.toLocaleString("en")}</td>
                <td className="n">{formatPercent(data.probability, 2)}</td>
                <td className="n">{formatPercent(data.margin, 2)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>

      <div className="meta">
        <span>Both teams score {formatPercent(multiSimulation.btts.probability)}</span>
        <span>Over 2.5 goals {formatPercent(multiSimulation.over25.probability)}</span>
        <span>Seed {multiSimulation.seed}</span>
      </div>

      <div className="chips">
        {multiSimulation.topScores.map((score) => (
          <span
            key={score.score}
            className="chip"
            style={{ cursor: "default" }}
          >
            {score.score} · {formatPercent(score.probability)}
          </span>
        ))}
      </div>

      <p className="note">{multiSimulation.note}</p>
    </div>
  );
}
