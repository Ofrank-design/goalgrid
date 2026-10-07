import { lineColor } from "./helpers";
import type { MatchPlayerView } from "./useMatchPlayer";

export function Momentum({ v }: { v: MatchPlayerView }) {
  const { homeTeam, awayTeam, kit, homeMomentumShare, momentumBlocks, maxMomentum } = v;
  return (
    <div className="card">
      <b>Momentum</b>
      <span className="note"> last 10 minutes</span>

      <div style={{ margin: "10px 0" }}>
        <div style={{ display: "flex", justifyContent: "space-between" }}>
          <span>{homeTeam.shortName}</span>
          <span>{awayTeam.shortName}</span>
        </div>
        <div
          style={{
            display: "flex",
            height: 12,
            borderRadius: 6,
            overflow: "hidden",
          }}
        >
          <i
            style={{
              width: `${homeMomentumShare * 100}%`,
              background: lineColor(kit.home),
              transition: "width .3s",
            }}
          />
          <i style={{ flex: 1, background: lineColor(kit.away) }} />
        </div>
      </div>

      <svg
        viewBox="0 0 180 60"
        role="img"
        aria-label="Momentum in five minute blocks"
        style={{ width: "100%", height: 64 }}
      >
        <line
          x1="0"
          y1="30"
          x2="180"
          y2="30"
          stroke="rgba(127,127,127,.4)"
        />
        {momentumBlocks.map((item, index) => (
          <rect
            key={`${item.from}-${index}`}
            x={index * 10 + 1}
            width="8"
            y={
              item.value >= 0
                ? 30 - (item.value / maxMomentum) * 28
                : 30
            }
            height={Math.max(
              0.5,
              (Math.abs(item.value) / maxMomentum) * 28,
            )}
            fill={
              item.value >= 0
                ? lineColor(kit.home)
                : lineColor(kit.away)
            }
          />
        ))}
      </svg>

      <span className="note">
        Bars above the line favour {homeTeam.shortName}. Built from goals,
        shots and corners.
      </span>
    </div>
  );
}
