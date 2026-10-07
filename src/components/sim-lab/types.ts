import type { MatchSim } from "@/lib/simulation/match";

export type OutcomeSummary = {
  home: number;
  draw: number;
  away: number;
  btts: number;
  over25: number;
  xgHome: number;
  xgAway: number;
};

export type SimRun = MatchSim & {
  id: string | null;
  baseline: OutcomeSummary;
  scenario: OutcomeSummary;
  applied: {
    id: string;
    label: string;
    kind: string;
    mh: number;
    ma: number;
  }[];
  engineVersion?: string;
  error?: string;
};

export interface InitialSimulation {
  sim: SimRun;
  league: string;
  home: string;
  away: string;
  engineVersion: string;
  currentEngine: string;
}

export type MultiSimulation = {
  runs: number;
  seed: string;
  home: { count: number; probability: number; margin: number };
  draw: { count: number; probability: number; margin: number };
  away: { count: number; probability: number; margin: number };
  btts: { probability: number; margin: number };
  over25: { probability: number; margin: number };
  topScores: { score: string; count: number; probability: number }[];
  note: string;
  error?: string;
};
export type Preset = { id: string; label: string; kind: string; note: string };

export interface SimLabProps {
  maxRuns: number;
  premium?: boolean;
  initial?: InitialSimulation;
}
