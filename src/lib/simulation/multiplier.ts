import { anomalies, autocorrelation, runsTest, streaks, summary } from "@/lib/lab/stats";
import { makeRng } from "./rng";

/**
 * Generic synthetic multiplier process for studying distributions and
 * variance. It is deliberately disconnected from any named game or operator.
 */
export type Family = "exponential" | "pareto" | "lognormal";

export interface MultiplierConfig {
  family: Family;
  param: number;
  instantStop: number;
  rounds: number;
  seed: string;
  hypotheticalTarget?: number;
  virtualBalance?: number;
  virtualUnit?: number;
}

export const MAX_ROUNDS = 20_000;
export const CAP = 1000;

function normalSample(random: () => number) {
  return (
    Math.sqrt(-2 * Math.log(1 - random())) *
    Math.cos(2 * Math.PI * random())
  );
}

/** A single synthetic round, bounded to the configured range. */
export function draw(
  random: () => number,
  config: Pick<MultiplierConfig, "family" | "param" | "instantStop">,
) {
  if (random() < config.instantStop) {
    return 1;
  }

  const uniform = Math.max(random(), 1e-12);
  const multiplier =
    config.family === "exponential"
      ? 1 + -Math.log(uniform) / config.param
      : config.family === "pareto"
        ? Math.pow(uniform, -1 / config.param)
        : Math.exp(config.param * normalSample(random));

  return (
    Math.round(Math.min(CAP, Math.max(1, multiplier)) * 100) / 100
  );
}

export function validate(config: Partial<MultiplierConfig>): string | null {
  if (
    !config.family ||
    !["exponential", "pareto", "lognormal"].includes(config.family)
  ) {
    return "Choose a distribution family.";
  }
  if (!(config.param! > 0.05 && config.param! <= 20)) {
    return "The shape parameter must be between 0.05 and 20.";
  }
  if (!(config.instantStop! >= 0 && config.instantStop! <= 0.5)) {
    return "Instant-stop probability must be between 0 and 0.5.";
  }
  if (
    !Number.isInteger(config.rounds) ||
    config.rounds! < 50 ||
    config.rounds! > MAX_ROUNDS
  ) {
    return `Rounds must be between 50 and ${MAX_ROUNDS.toLocaleString("en")}.`;
  }
  if (
    config.hypotheticalTarget != null &&
    !(config.hypotheticalTarget >= 1.01 && config.hypotheticalTarget <= 100)
  ) {
    return "The hypothetical target must be between 1.01 and 100.";
  }

  return null;
}

/** Run a virtual-balance experiment against a declared synthetic rule. */
export function virtualRule(
  values: number[],
  target: number,
  balance: number,
  unit: number,
) {
  let currentBalance = balance;
  let peakBalance = balance;
  let maxDrawdown = 0;
  let wins = 0;
  let ruinedAt: number | null = null;
  const balancePath: number[] = [];

  values.forEach((multiplier, index) => {
    if (ruinedAt != null) return;

    if (currentBalance < unit) {
      ruinedAt = index;
      return;
    }

    if (multiplier >= target) {
      currentBalance += unit * (target - 1);
      wins += 1;
    } else {
      currentBalance -= unit;
    }

    peakBalance = Math.max(peakBalance, currentBalance);
    maxDrawdown = Math.max(maxDrawdown, peakBalance - currentBalance);

    if (index % Math.ceil(values.length / 200) === 0) {
      balancePath.push(Math.round(currentBalance * 100) / 100);
    }
  });

  const roundsPlayed = ruinedAt ?? values.length;
  const hitRate = roundsPlayed ? wins / roundsPlayed : 0;

  return {
    target,
    unit,
    startBalance: balance,
    endBalance: Math.round(currentBalance * 100) / 100,
    minBalanceSeen: null as number | null,
    roundsPlayed,
    ruinedAtRound: ruinedAt,
    hitRate: Math.round(hitRate * 10000) / 10000,
    maxDrawdown: Math.round(maxDrawdown * 100) / 100,
    maxDrawdownShare: peakBalance
      ? Math.round((maxDrawdown / peakBalance) * 10000) / 10000
      : 0,
    balancePath,
    impliedHitRateForBreakEven:
      Math.round((1 / target) * 10000) / 10000,
  };
}

export function simulateMultiplier(config: MultiplierConfig) {
  const random = makeRng(config.seed);
  const values = Array.from({ length: config.rounds }, () =>
    draw(random, config),
  );
  const statistics = summary(values);
  const target = config.hypotheticalTarget ?? 2;
  const shareAtLeast = (threshold: number) =>
    values.filter((value) => value >= threshold).length / values.length;
  const tail = [1.5, 2, 5, 10, 50].map((threshold) => ({
    atLeast: threshold,
    share: Math.round(shareAtLeast(threshold) * 10000) / 10000,
  }));

  return {
    config,
    summary: statistics,
    tail,
    instantStopShare:
      Math.round(
        (values.filter((value) => value === 1).length / values.length) *
          10000,
      ) / 10000,
    streaksBelowTarget: streaks(values, target),
    randomness: {
      runs: runsTest(values),
      autocorrelation: autocorrelation(values, 5),
    },
    outliers: anomalies(values),
    firstRounds: values.slice(0, 100),
    virtualExperiment: config.hypotheticalTarget
      ? virtualRule(
          values,
          config.hypotheticalTarget,
          config.virtualBalance ?? 1000,
          config.virtualUnit ?? 10,
        )
      : null,
  };
}
