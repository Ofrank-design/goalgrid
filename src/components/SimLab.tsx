"use client";

import { MatchResult } from "./sim-lab/MatchResult";
import { MultiResult } from "./sim-lab/MultiResult";
import { SetupCard } from "./sim-lab/SetupCard";
import { SimBanner } from "./sim-lab/SimBanner";
import type { SimLabProps } from "./sim-lab/types";
import { useSimLab } from "./sim-lab/useSimLab";

// Existing imports (SeasonSim, the simulation page) keep using these names from here.
export { SimBanner };
export type { SimRun, InitialSimulation } from "./sim-lab/types";

export function SimLab(props: SimLabProps) {
  const v = useSimLab(props);

  return (
    <div style={{ display: "grid", gap: 16 }}>
      <SimBanner />

      <SetupCard v={v} />

      {v.simulation && <MatchResult v={v} simulation={v.simulation} />}

      {v.multiSimulation && <MultiResult v={v} multiSimulation={v.multiSimulation} />}

      <p className="note">
        * Scenario assumptions are illustrative. GoalGrid does not currently
        have player-level data for these inputs, so they are not presented as
        measured player effects. Simulations never change real predictions,
        user records, leaderboards or trophies. 18+. Play responsibly.
      </p>
    </div>
  );
}
