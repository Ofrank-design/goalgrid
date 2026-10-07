export type Pick = "home" | "draw" | "away";
export const outcomeOf = (hg: number, ag: number): Pick => (hg > ag ? "home" : hg === ag ? "draw" : "away");
/** The pick carries `confidence` percent and the other two outcomes share the rest. Points reward calibration: 0 equals guessing 1 in 3,
 *  a confident right call scores well, a confident wrong call costs more than a cautious one. */
export function pickPoints(pick: Pick, confidencePct: number, outcome: Pick): number {
  const c = Math.min(Math.max(confidencePct, 40), 95) / 100, rest = (1 - c) / 2;
  const brier = (["home", "draw", "away"] as Pick[]).reduce((s, k) => s + ((k === pick ? c : rest) - (k === outcome ? 1 : 0)) ** 2, 0);
  return Math.round(100 * (2 / 3 - brier));
}
