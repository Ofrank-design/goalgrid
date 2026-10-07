/** Simulation minutes that pass per millisecond of real time at 1x. */
export const MINUTES_PER_MS = 1 / 150;
export const GOAL_PROGRESS = 0.85;

export const EVENT_LABELS: Record<string, string> = {
  goal: "Goal",
  shot_on_target: "Shot on target",
  shot: "Shot off target",
  corner: "Corner",
  yellow: "Yellow card",
  red: "Red card",
  half_time: "Half time",
  full_time: "Full time",
  substitution: "Substitution",
};

export const MOMENTUM_WEIGHTS: Record<string, number> = {
  goal: 3,
  shot_on_target: 2,
  shot: 1,
  corner: 0.5,
};
