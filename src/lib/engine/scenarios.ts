import { MAXG } from "./models/math";

export const MULT_MIN = 0.5;
export const MULT_MAX = 1.5;

export interface Summary {
  home: number;
  draw: number;
  away: number;
  btts: number;
  over25: number;
  xgHome: number;
  xgAway: number;
}

export function summarize(matrix: number[][]): Summary {
  let homeWin = 0;
  let draw = 0;
  let awayWin = 0;
  let bothTeamsScore = 0;
  let over25 = 0;
  let expectedHomeGoals = 0;
  let expectedAwayGoals = 0;
  let totalProbability = 0;

  for (let homeGoals = 0; homeGoals <= MAXG; homeGoals += 1) {
    for (let awayGoals = 0; awayGoals <= MAXG; awayGoals += 1) {
      const probability = matrix[homeGoals][awayGoals];
      totalProbability += probability;

      if (homeGoals > awayGoals) {
        homeWin += probability;
      } else if (homeGoals === awayGoals) {
        draw += probability;
      } else {
        awayWin += probability;
      }

      if (homeGoals > 0 && awayGoals > 0) {
        bothTeamsScore += probability;
      }
      if (homeGoals + awayGoals > 2) {
        over25 += probability;
      }

      expectedHomeGoals += probability * homeGoals;
      expectedAwayGoals += probability * awayGoals;
    }
  }

  const ratio = (value: number) =>
    Math.round((value / totalProbability) * 1000) / 1000;

  return {
    home: ratio(homeWin),
    draw: ratio(draw),
    away: ratio(awayWin),
    btts: ratio(bothTeamsScore),
    over25: ratio(over25),
    xgHome:
      Math.round((expectedHomeGoals / totalProbability) * 100) / 100,
    xgAway:
      Math.round((expectedAwayGoals / totalProbability) * 100) / 100,
  };
}

export function tiltMatrix(
  matrix: number[][],
  homeMultiplier: number,
  awayMultiplier: number,
): number[][] {
  const weighted = matrix.map((row, homeGoals) =>
    row.map(
      (probability, awayGoals) =>
        probability *
        Math.pow(homeMultiplier, homeGoals) *
        Math.pow(awayMultiplier, awayGoals),
    ),
  );

  const total = weighted.reduce(
    (sum, row) => sum + row.reduce((rowSum, value) => rowSum + value, 0),
    0,
  );

  return weighted.map((row) => row.map((value) => value / total));
}

export interface ScenarioDef {
  id: string;
  label: string;
  kind: "derived" | "assumption";
  mh: number;
  ma: number;
  note: string;
}

const ASSUMPTION_NOTE =
  "This is an adjustable assumption. GoalGrid does not have player-level data to measure this effect directly.";

export const PRESETS: ScenarioDef[] = [
  {
    id: "home-striker-out",
    label: "Home striker unavailable",
    kind: "assumption",
    mh: 0.9,
    ma: 1,
    note: ASSUMPTION_NOTE,
  },
  {
    id: "away-striker-out",
    label: "Away striker unavailable",
    kind: "assumption",
    mh: 1,
    ma: 0.9,
    note: ASSUMPTION_NOTE,
  },
  {
    id: "home-keeper-out",
    label: "Home goalkeeper unavailable",
    kind: "assumption",
    mh: 1,
    ma: 1.1,
    note: ASSUMPTION_NOTE,
  },
  {
    id: "away-keeper-out",
    label: "Away goalkeeper unavailable",
    kind: "assumption",
    mh: 1.1,
    ma: 1,
    note: ASSUMPTION_NOTE,
  },
  {
    id: "heavy-rain",
    label: "Heavy rain",
    kind: "assumption",
    mh: 0.94,
    ma: 0.94,
    note: ASSUMPTION_NOTE,
  },
  {
    id: "home-fatigue",
    label: "Home team fatigue",
    kind: "assumption",
    mh: 0.95,
    ma: 1,
    note: ASSUMPTION_NOTE,
  },
  {
    id: "away-fatigue",
    label: "Away team fatigue",
    kind: "assumption",
    mh: 1,
    ma: 0.95,
    note: ASSUMPTION_NOTE,
  },
  {
    id: "home-rest-advantage",
    label: "Home rest advantage",
    kind: "assumption",
    mh: 1.04,
    ma: 0.97,
    note: ASSUMPTION_NOTE,
  },
  {
    id: "no-home-advantage",
    label: "Home advantage removed",
    kind: "derived",
    mh: 1,
    ma: 1,
    note: "Derived from the match's baseline expected goals by moving both sides toward the geometric mean.",
  },
];

export type Applied = {
  id: string;
  label: string;
  kind: ScenarioDef["kind"] | "custom";
  mh: number;
  ma: number;
  note: string;
};

const clamp = (value: number) =>
  Math.min(MULT_MAX, Math.max(MULT_MIN, value));

export function resolveScenarios(
  ids: string[],
  custom: { home?: number; away?: number } | null,
  base: Summary,
):
  | { ok: true; applied: Applied[]; mh: number; ma: number }
  | { ok: false; error: string } {
  const applied: Applied[] = [];
  let homeMultiplier = 1;
  let awayMultiplier = 1;

  for (const id of ids) {
    const preset = PRESETS.find((scenario) => scenario.id === id);
    if (!preset) {
      return { ok: false, error: `Unknown scenario: ${id}` };
    }

    let presetHome = preset.mh;
    let presetAway = preset.ma;

    if (id === "no-home-advantage") {
      const geometricMean = Math.sqrt(base.xgHome * base.xgAway);
      presetHome = base.xgHome ? geometricMean / base.xgHome : 1;
      presetAway = base.xgAway ? geometricMean / base.xgAway : 1;
    }

    homeMultiplier *= presetHome;
    awayMultiplier *= presetAway;

    applied.push({
      id,
      label: preset.label,
      kind: preset.kind,
      mh: Math.round(presetHome * 1000) / 1000,
      ma: Math.round(presetAway * 1000) / 1000,
      note: preset.note,
    });
  }

  if (custom && (custom.home != null || custom.away != null)) {
    const customHome = custom.home ?? 1;
    const customAway = custom.away ?? 1;

    if (
      ![customHome, customAway].every(
        (value) =>
          Number.isFinite(value) &&
          value >= MULT_MIN &&
          value <= MULT_MAX,
      )
    ) {
      return {
        ok: false,
        error: `Custom multipliers must be between ${MULT_MIN} and ${MULT_MAX}`,
      };
    }

    homeMultiplier *= customHome;
    awayMultiplier *= customAway;

    applied.push({
      id: "custom",
      label: "Custom assumption",
      kind: "custom",
      mh: customHome,
      ma: customAway,
      note: "Your own multipliers applied to each side's expected goals.",
    });
  }

  return {
    ok: true,
    applied,
    mh: clamp(homeMultiplier),
    ma: clamp(awayMultiplier),
  };
}

export const pp = (before: number, after: number) =>
  Math.round((after - before) * 1000) / 10;

export function compareSummaries(base: Summary, scenario: Summary) {
  return {
    homePp: pp(base.home, scenario.home),
    drawPp: pp(base.draw, scenario.draw),
    awayPp: pp(base.away, scenario.away),
    bttsPp: pp(base.btts, scenario.btts),
    over25Pp: pp(base.over25, scenario.over25),
    xgHome: Math.round((scenario.xgHome - base.xgHome) * 100) / 100,
    xgAway: Math.round((scenario.xgAway - base.xgAway) * 100) / 100,
  };
}
