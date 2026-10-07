import "server-only";

export type GoalGridTier = "free" | "pro" | "premium";

import { GOALGRID_LIMITS } from "./limits";

export { GOALGRID_LIMITS };


export const MODEL_TIERS = {
  A: { minModels: 1, maxModels: 15 },
  B: { minModels: 0, maxModels: 30 },
  C: { minModels: 0, maxModels: 40 },
  D: { minModels: 0, maxModels: 1 },
} as const;

export function simulationLimits(tier: GoalGridTier) {
  if (tier === "premium") return { maxRuns: GOALGRID_LIMITS.simulation.multiPremium, maxSeasons: GOALGRID_LIMITS.simulation.seasonPremium };
  if (tier === "pro") return { maxRuns: GOALGRID_LIMITS.simulation.multiPro, maxSeasons: GOALGRID_LIMITS.simulation.seasonPro };
  return { maxRuns: 0, maxSeasons: 0 };
}

export function controlPlaneSnapshot() {
  return {
    limits: GOALGRID_LIMITS,
    flags: {
      "simulation.addendum": process.env.ENABLE_SIM_ADDENDUM === "true",
      "simulation.experiments": true,
      "community.private_circles": true,
      "notifications.delivery": true,
    },
  };
}
