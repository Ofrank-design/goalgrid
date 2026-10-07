/** Prediction record from settled picks only. Void picks and booking shares never count. Built in one place so the profile, leaderboard and trophies agree. */
export interface SettledPick { pick: string; outcome: string; points: number | null; settledAt: string }
export interface PredictionRecord { evaluated: number; correct: number; incorrect: number; accuracy: number; points: number; currentStreak: number; longestStreak: number; building: boolean }
export const MIN_PUBLIC_SAMPLE = 10;
export function recordOf(picks: SettledPick[]): PredictionRecord {
  const ev = picks.filter(p => p.outcome !== "void").sort((a, b) => a.settledAt.localeCompare(b.settledAt)); let cur = 0, best = 0, correct = 0, points = 0;
  for (const p of ev) { if (p.pick === p.outcome) { correct++; cur++; best = Math.max(best, cur); } else cur = 0; points += p.points ?? 0; }
  return { evaluated: ev.length, correct, incorrect: ev.length - correct, accuracy: ev.length ? Math.round((correct / ev.length) * 1000) / 10 : 0, points, currentStreak: cur, longestStreak: best, building: ev.length < MIN_PUBLIC_SAMPLE };
}
