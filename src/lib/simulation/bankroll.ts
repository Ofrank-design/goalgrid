import { makeRng } from "./rng";

/**
 * Educational risk experiments use a virtual balance only. Nothing here sets
 * a real stake or supplies an edge that a user did not provide themselves.
 */
export interface RiskConfig {
  probability: number;
  odds: number;
  mode: "fixed" | "percent" | "kelly";
  unit: number;
  percent?: number;
  kellyFraction?: number;
  startBalance: number;
  bets: number;
  paths: number;
  seed: string;
}

export const MAX_BETS = 1000;
export const MAX_PATHS = 2000;

export const kellyFraction = (probability: number, odds: number) => {
  const netOdds = odds - 1;
  return netOdds > 0
    ? (netOdds * probability - (1 - probability)) / netOdds
    : 0;
};

export function validate(config: Partial<RiskConfig>): string | null {
  if (!(config.probability! > 0 && config.probability! < 1)) {
    return "Enter an assumed probability between 0 and 1.";
  }
  if (!(config.odds! >= 1.05 && config.odds! <= 100)) {
    return "Odds must be between 1.05 and 100.";
  }
  if (!["fixed", "percent", "kelly"].includes(config.mode as string)) {
    return "Choose a sizing method.";
  }
  if (!(config.startBalance! >= 10 && config.startBalance! <= 1e6)) {
    return "The virtual balance must be between 10 and 1,000,000.";
  }
  if (
    !Number.isInteger(config.bets) ||
    config.bets! < 5 ||
    config.bets! > MAX_BETS
  ) {
    return `Experiments run 5 to ${MAX_BETS} hypothetical rounds.`;
  }
  if (
    !Number.isInteger(config.paths) ||
    config.paths! < 10 ||
    config.paths! > MAX_PATHS
  ) {
    return `Run 10 to ${MAX_PATHS} repeated experiments.`;
  }
  if (
    config.mode === "fixed" &&
    !(config.unit! > 0 && config.unit! <= config.startBalance!)
  ) {
    return "The fixed unit must be positive and no larger than the balance.";
  }
  if (
    config.mode === "percent" &&
    !(config.percent! > 0 && config.percent! <= 25)
  ) {
    return "Choose a percentage between 0 and 25.";
  }
  if (
    config.mode === "kelly" &&
    !(config.kellyFraction! > 0 && config.kellyFraction! <= 1)
  ) {
    return "Choose a fraction between 0 and 1.";
  }

  return null;
}

function stakeFor(config: RiskConfig, balance: number) {
  if (config.mode === "fixed") {
    return Math.min(config.unit, balance);
  }
  if (config.mode === "percent") {
    return balance * (config.percent! / 100);
  }

  return (
    balance *
    Math.max(0, kellyFraction(config.probability, config.odds)) *
    config.kellyFraction!
  );
}

export function runRisk(config: RiskConfig) {
  const random = makeRng(config.seed);
  const endingBalances: number[] = [];
  const maxDrawdowns: number[] = [];
  const ruinThreshold = config.startBalance * 0.05;
  let ruinedPaths = 0;
  let pathsBelowStart = 0;
  const samplePaths: number[][] = [];

  for (let pathIndex = 0; pathIndex < config.paths; pathIndex += 1) {
    let balance = config.startBalance;
    let peakBalance = balance;
    let maxDrawdown = 0;
    let ruined = false;
    const path = [balance];

    for (let round = 0; round < config.bets; round += 1) {
      const stake = stakeFor(config, balance);
      if (stake <= 0.0001) break;

      balance +=
        random() < config.probability
          ? stake * (config.odds - 1)
          : -stake;

      peakBalance = Math.max(peakBalance, balance);
      maxDrawdown = Math.max(
        maxDrawdown,
        (peakBalance - balance) / peakBalance,
      );

      if (balance <= ruinThreshold) {
        ruined = true;
      }

      if (pathIndex < 12) {
        path.push(Math.round(balance * 100) / 100);
      }
    }

    if (pathIndex < 12) {
      samplePaths.push(path);
    }

    endingBalances.push(balance);
    maxDrawdowns.push(maxDrawdown);
    if (ruined) ruinedPaths += 1;
    if (balance < config.startBalance) pathsBelowStart += 1;
  }

  const sortedBalances = [...endingBalances].sort((a, b) => a - b);
  const sortedDrawdowns = [...maxDrawdowns].sort((a, b) => a - b);
  const percentile = (values: number[], probability: number) => {
    const index = Math.min(
      values.length - 1,
      Math.floor(probability * values.length),
    );
    return Math.round(values[index] * 100) / 100;
  };

  return {
    config,
    kellyFullFraction:
      Math.round(kellyFraction(config.probability, config.odds) * 10000) /
      10000,
    expectedValuePerUnit:
      Math.round(
        (config.probability * (config.odds - 1) -
          (1 - config.probability)) *
          10000,
      ) / 10000,
    breakEvenProbability: Math.round((1 / config.odds) * 10000) / 10000,
    endingBalance: {
      p5: percentile(sortedBalances, 0.05),
      p25: percentile(sortedBalances, 0.25),
      median: percentile(sortedBalances, 0.5),
      p75: percentile(sortedBalances, 0.75),
      p95: percentile(sortedBalances, 0.95),
    },
    shareEndedBelowStart:
      Math.round((pathsBelowStart / config.paths) * 10000) / 10000,
    ruinShare: Math.round((ruinedPaths / config.paths) * 10000) / 10000,
    medianMaxDrawdown:
      Math.round(sortedDrawdowns[Math.floor(sortedDrawdowns.length / 2)] * 10000) /
      10000,
    p95MaxDrawdown:
      Math.round(sortedDrawdowns[Math.floor(sortedDrawdowns.length * 0.95)] * 10000) /
      10000,
    samplePaths,
  };
}

/** Show how sensitive the result is to a small change in the user's assumption. */
export function sensitivity(config: RiskConfig) {
  return [-0.05, -0.02, 0, 0.02].map((delta) => {
    const probability = Math.min(
      0.99,
      Math.max(0.01, config.probability + delta),
    );
    const result = runRisk({
      ...config,
      probability,
      paths: Math.min(config.paths, 500),
    });

    return {
      assumedProbability: Math.round(probability * 1000) / 1000,
      medianEnding: result.endingBalance.median,
      ruinShare: result.ruinShare,
      kellyFullFraction: result.kellyFullFraction,
    };
  });
}
