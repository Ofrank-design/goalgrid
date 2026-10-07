import { EVENT_LABELS } from "./constants";
import { lineColor, formatClock } from "./helpers";
import { TeamTag } from "./TeamTag";
import type { MatchPlayerView } from "./useMatchPlayer";

export function Scoreboard({ v }: { v: MatchPlayerView }) {
  const { sim, homeTeam, awayTeam, kit, current, score, events, finished } = v;
  return (
    <div className="card" style={{ display: "grid", gap: 6 }} aria-live="polite">
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr auto 1fr",
          alignItems: "center",
          gap: 10,
          textAlign: "center",
        }}
      >
        <TeamTag v={homeTeam} color={lineColor(kit.home)} />
        <div>
          <div className="n" style={{ fontSize: 34, fontWeight: 800 }}>
            {score.home} – {score.away}
          </div>
          <span className="note">
            {finished
              ? "FULL TIME"
              : `${formatClock(current.clock, sim.addedTime)} · SIMULATED`}
          </span>
        </div>
        <TeamTag v={awayTeam} color={lineColor(kit.away)} />
      </div>

      <div className="mp-sr" role="status">
        {events.length
          ? `${events[events.length - 1].label} ${
              EVENT_LABELS[events[events.length - 1].type]
            }`
          : ""}
      </div>
    </div>
  );
}
