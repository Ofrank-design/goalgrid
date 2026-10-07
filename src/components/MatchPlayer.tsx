"use client";

import { Controls } from "./match-player/Controls";
import { EventsCard } from "./match-player/EventsCard";
import { Explanation } from "./match-player/Explanation";
import { Momentum } from "./match-player/Momentum";
import { Scoreboard } from "./match-player/Scoreboard";
import { Stage } from "./match-player/Stage";
import { StatsCard } from "./match-player/StatsCard";
import type { MatchPlayerProps } from "./match-player/types";
import { useMatchPlayer } from "./match-player/useMatchPlayer";
import { WinChances } from "./match-player/WinChances";

/**
 * Replays a stored simulation on the pitch. Rendering reads engine events but
 * never changes the match score, statistics, probabilities or result.
 */
export function MatchPlayer(props: MatchPlayerProps) {
  const v = useMatchPlayer(props);

  return (
    <div
      className={v.reducedMotion ? "mp-reduced" : undefined}
      style={{ display: "grid", gap: 12 }}
    >
      <Scoreboard v={v} />
      <Stage v={v} />
      <Controls v={v} />

      <div className="grid">
        <WinChances v={v} />
        <Momentum v={v} />
      </div>

      <div className="grid">
        <EventsCard v={v} />
        <StatsCard v={v} />
      </div>

      {v.explanation && <Explanation explanation={v.explanation} />}

      <p className="note">
        Formations, positions, build-up passes and shirt numbers are
        illustrative. GoalGrid does not have lineup or player data for this
        visualization, so no player names are shown. The result, statistics and
        chances come from the simulation engine; the animation never changes them.
      </p>
    </div>
  );
}
