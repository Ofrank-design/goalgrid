/** Rules for prediction versions, kept pure so they can be tested without a database. */
export const ENGINE_VERSION = "engine-2.1.0", FREEZE_MINUTES = 15, MIN_CHANGE = 0.005;
export interface Probs { pHome: number; pDraw: number; pAway: number }
export interface VersionRow extends Probs { version: number; createdAt: string; engineVersion: string; confidence: number | null }
export const isFrozen = (kickoffMs: number, nowMs = Date.now()) => nowMs >= kickoffMs - FREEZE_MINUTES * 60_000;
export type Plan = { action: "insert"; version: number } | { action: "skip"; reason: "frozen" | "unchanged" };
/** A new version is written only before the freeze, and only when the prediction moved by at least half a percentage point or the engine changed. */
export function planVersion(latest: (Probs & { version: number; engineVersion: string }) | null, next: Probs, kickoffMs: number, nowMs = Date.now(), engineVersion = ENGINE_VERSION): Plan {
  if (isFrozen(kickoffMs, nowMs)) return { action: "skip", reason: "frozen" };
  if (!latest) return { action: "insert", version: 1 };
  const moved = Math.max(Math.abs(latest.pHome - next.pHome), Math.abs(latest.pDraw - next.pDraw), Math.abs(latest.pAway - next.pAway)) >= MIN_CHANGE;
  return moved || latest.engineVersion !== engineVersion ? { action: "insert", version: latest.version + 1 } : { action: "skip", reason: "unchanged" };
}
/** How the price moved between the first and the latest version, and the single largest step in between. */
export function movement(v: VersionRow[]) {
  if (v.length < 2) return { versions: v.length, change: null, largestStep: null };
  const s = [...v].sort((a, b) => a.version - b.version), a = s[0], b = s[s.length - 1], d = (x: number, y: number) => Math.round((y - x) * 1000) / 1000;
  let big = { from: s[0].version, to: s[1].version, size: 0 }; for (let i = 1; i < s.length; i++) { const size = Math.max(Math.abs(s[i].pHome - s[i - 1].pHome), Math.abs(s[i].pDraw - s[i - 1].pDraw), Math.abs(s[i].pAway - s[i - 1].pAway)); if (size > big.size) big = { from: s[i - 1].version, to: s[i].version, size: Math.round(size * 1000) / 1000 }; }
  return { versions: s.length, change: { home: d(a.pHome, b.pHome), draw: d(a.pDraw, b.pDraw), away: d(a.pAway, b.pAway) }, largestStep: big };
}
