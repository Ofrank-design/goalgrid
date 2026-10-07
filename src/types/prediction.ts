export interface HistMatch { date: string; home: string; away: string; hg: number; ag: number; hxg?: number; axg?: number }
export interface Probs { home: number; draw: number; away: number }
export interface ModelOutput extends Probs { lambdaHome?: number; lambdaAway?: number; matrix?: number[][] }
/** Everything a model may use besides history. Missing items make a model abstain, they never make it guess. */
export interface PredictCtx { market?: Probs | null; kickoffUtc?: string; weather?: { tempC: number; windKmh: number; rainChancePct: number | null } | null;
  /** Expected goal shifts (home minus away) from future feeds: injuries, lineups, tactics, structured news. */
  signals?: { availabilityShift?: number; lineupShift?: number; tacticalShift?: number; newsShift?: number } }
export interface FittedModel { predict(home: string, away: string, ctx?: PredictCtx): ModelOutput | null }
export type ModelFamily = "goals" | "bayesian" | "rating" | "machine-learning" | "deep-learning" | "context" | "market" | "state-space" | "copula" | "survival" | "specialist";
export interface Model { id: string; name: string; family: ModelFamily; fit(history: HistMatch[], now: Date): FittedModel | null;
  /** Data the model needs when it cannot run. */ needs?: string; /** Slow to fit: the holdout fit is reused instead of refitting. */ heavy?: boolean; /** Not validated on history, so it is capped at half weight. */ prior?: boolean; /** One line on how the model is built, shown next to its metrics. */ about?: string }
export interface ModelMetric { id: string; name: string; family: ModelFamily; weight: number; logLoss: number | null; brier: number | null; testMatches: number; calibrated?: boolean; status: "tested" | "unvalidated" | "waiting" | "degraded" | "shadow"; note: string | null }
export interface Prediction {
  probabilities: Probs; expectedGoals: { home: number; away: number }; mostLikelyScore: { home: number; away: number; probability: number };
  btts: number; over25: number; confidence: number; agreement: number; dataQuality: number; marketGap: number | null;
  models: { id: string; name: string; family: ModelFamily; weight: number; home: number; draw: number; away: number }[]; conformal?: { set: ("home" | "draw" | "away")[]; coverage: number } | null; stacked?: boolean; modelsUsed: number; abstained: { id: string; name: string; reason: string }[];
}
