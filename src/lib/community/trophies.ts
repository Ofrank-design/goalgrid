import type { PredictionRecord } from "./userstats";
export interface TrophyBasis { submitted: number; record: PredictionRecord; exactHits: number; activePosts: number; likesOnPosts: number; topTen: boolean }
/** Rules from the spec. Awards are idempotent at the database level. Booking codes, claimed profit, stake and unverified screenshots appear nowhere in these inputs, so they can never earn a trophy. */
export const TROPHY_RULES: { code: string; test: (b: TrophyBasis) => boolean }[] = [
  { code: "first-kick", test: b => b.submitted >= 1 }, { code: "ten-match-analyst", test: b => b.record.evaluated >= 10 },
  { code: "form-finder", test: b => b.record.evaluated >= 20 && b.record.accuracy >= 60 }, { code: "three-streak", test: b => b.record.longestStreak >= 3 }, { code: "five-streak", test: b => b.record.longestStreak >= 5 },
  { code: "exact-eye", test: b => b.exactHits >= 3 }, { code: "community-scout", test: b => b.activePosts >= 5 }, { code: "matchday-voice", test: b => b.likesOnPosts >= 20 }, { code: "top-table", test: b => b.topTen },
];
export const earned = (b: TrophyBasis, have: string[]) => TROPHY_RULES.filter(r => !have.includes(r.code) && r.test(b)).map(r => r.code);
