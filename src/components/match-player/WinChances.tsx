import { lineColor } from "./helpers";
import type { MatchPlayerView } from "./useMatchPlayer";

export function WinChances({ v }: { v: MatchPlayerView }) {
  const { homeTeam, awayTeam, kit, live, previousProbability, arrow, probabilityChart } = v;
  return (
    <div className="card">
      <b>Win chances</b>
      <span className="note"> from the score and time left only</span>

      {(
        [
          ["home", homeTeam.shortName, kit.home],
          ["draw", "Draw", { fill: "#94a3b8", trim: "#94a3b8" }],
          ["away", awayTeam.shortName, kit.away],
        ] as const
      ).map(([outcome, label, color]) => (
        <div key={outcome} style={{ margin: "8px 0" }}>
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <span>{label}</span>
            <b className="n">
              {(live[outcome] * 100).toFixed(0)}%{" "}
              <span style={{ opacity: 0.7 }}>
                {arrow(live[outcome], previousProbability[outcome])}
              </span>
            </b>
          </div>
          <div className="mp-bar">
            <i
              style={{
                width: `${live[outcome] * 100}%`,
                background: lineColor(color),
              }}
            />
          </div>
        </div>
      ))}

      {probabilityChart && (
        <svg
          viewBox="0 0 300 80"
          role="img"
          aria-label="Win chances over the match"
          style={{ width: "100%", height: 84, marginTop: 6 }}
        >
          <line
            x1="0"
            y1="42"
            x2="300"
            y2="42"
            stroke="rgba(127,127,127,.3)"
            strokeDasharray="3 3"
          />
          <line
            x1="150"
            y1="0"
            x2="150"
            y2="80"
            stroke="rgba(127,127,127,.25)"
          />
          {(["home", "draw", "away"] as const).map((outcome) => (
            <polyline
              key={outcome}
              fill="none"
              strokeWidth="2"
              stroke={
                outcome === "draw"
                  ? "#94a3b8"
                  : lineColor(kit[outcome])
              }
              points={probabilityChart(outcome)}
            />
          ))}
        </svg>
      )}
    </div>
  );
}
