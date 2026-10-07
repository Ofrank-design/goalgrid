import { z } from "zod";
/** Extra pick markets and their points, from the spec: BTTS 2, over/under 2.5 is 2, exact score 8. The 1X2 pick keeps its calibration scoring. */
export type Market = "btts" | "over25" | "exact";
export const MARKET_POINTS: Record<Market, number> = { btts: 2, over25: 2, exact: 8 };
export const VALUES: Record<Exclude<Market, "exact">, readonly string[]> = { btts: ["yes", "no"], over25: ["over", "under"] };
export const exactValue = z.string().regex(/^\d{1,2}-\d{1,2}$/).refine(s => s.split("-").every(n => Number(n) <= 15), "Scores above 15 goals are not accepted");
export const marketPick = z.discriminatedUnion("market", [z.object({ market: z.literal("btts"), value: z.enum(["yes", "no"]) }), z.object({ market: z.literal("over25"), value: z.enum(["over", "under"]) }), z.object({ market: z.literal("exact"), value: exactValue })]);
export const resultFor = (market: Market, hg: number, ag: number): string => (market === "btts" ? (hg > 0 && ag > 0 ? "yes" : "no") : market === "over25" ? (hg + ag > 2 ? "over" : "under") : `${hg}-${ag}`);
export const scoreMarket = (market: Market, value: string, hg: number, ag: number) => { const correct = resultFor(market, hg, ag) === value; return { correct, points: correct ? MARKET_POINTS[market] : 0 }; };
export interface SettledMarket { market: Market; correct: boolean }
export const marketTotals = (rows: SettledMarket[]) => (["btts", "over25", "exact"] as Market[]).map(m => { const r = rows.filter(x => x.market === m); return { market: m, total: r.length, correct: r.filter(x => x.correct).length }; });
