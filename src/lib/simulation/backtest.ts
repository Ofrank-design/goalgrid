import { generateLeague, playSeason, rates } from "./fictional";
import { makeRng } from "./rng";
/** Constrained backtest over synthetic data. A rule is a list of simple conditions on the model's stated chances. The result compares how often the declared outcome happened with the chances the model gave, so it checks honesty of the numbers, not profit. */
export const FIELDS = ["pHome", "pDraw", "pAway", "btts", "over25"] as const, OUTCOMES = ["home", "draw", "away", "btts", "over25"] as const;
export type Field = (typeof FIELDS)[number];
export type Outcome = (typeof OUTCOMES)[number];
export interface Rule { conditions: { field: Field; op: ">=" | "<="; value: number }[]; outcome: Outcome }
export interface Obs { index: number; pHome: number; pDraw: number; pAway: number; btts: number; over25: number; hg: number; ag: number }
export const DISCLAIMER = "Historical and synthetic results do not guarantee future outcomes. This is a research simulation, not financial or betting advice.";
const pois = (k: number, l: number) => { let f = 1; for (let i = 2; i <= k; i++) f *= i; return Math.exp(-l) * l ** k / f; };
/** Chances for a fictional match from its rates, with independent Poisson goals. */
export function chances(lh: number, la: number) { let h = 0, d = 0, a = 0, b = 0, o = 0; for (let x = 0; x < 12; x++) for (let y = 0; y < 12; y++) { const p = pois(x, lh) * pois(y, la); if (x > y) h += p; else if (x === y) d += p; else a += p; if (x > 0 && y > 0) b += p; if (x + y > 2) o += p; } const s = h + d + a; return { pHome: h / s, pDraw: d / s, pAway: a / s, btts: b, over25: o }; }
export function syntheticObservations(seed: string, teams: number, seasons: number): Obs[] {
  const out: Obs[] = []; for (let s = 0; s < seasons; s++) { const lg = generateLeague(teams, `${seed}:${s}`), by = new Map(lg.map(t => [t.name, t])), res = playSeason(lg, `${seed}:${s}`); for (const m of res.matches) { const { lh, la } = rates(by.get(m.home)!, by.get(m.away)!, 1.35, 1.2); out.push({ index: out.length, ...chances(lh, la), hg: m.hg, ag: m.ag }); } } return out;
}
export function validateRule(r: Partial<Rule>): string | null {
  if (!Array.isArray(r.conditions) || r.conditions.length < 1 || r.conditions.length > 4) return "Use 1 to 4 conditions."; if (!r.outcome || !(OUTCOMES as readonly string[]).includes(r.outcome)) return "Choose an outcome to check.";
  for (const c of r.conditions) { if (!(FIELDS as readonly string[]).includes(c.field) || ![">=", "<="].includes(c.op) || !(c.value >= 0 && c.value <= 1)) return "Each condition needs a field, >= or <=, and a value from 0 to 1."; } return null;
}
const happened = (o: Obs, k: Outcome) => k === "home" ? o.hg > o.ag : k === "draw" ? o.hg === o.ag : k === "away" ? o.hg < o.ag : k === "btts" ? o.hg > 0 && o.ag > 0 : o.hg + o.ag > 2;
const stated = (o: Obs, k: Outcome) => k === "home" ? o.pHome : k === "draw" ? o.pDraw : k === "away" ? o.pAway : k === "btts" ? o.btts : o.over25;
export function backtest(obs: Obs[], rule: Rule) {
  const hits = obs.filter(o => rule.conditions.every(c => (c.op === ">=" ? o[c.field] >= c.value : o[c.field] <= c.value))); const n = hits.length;
  if (n < 30) return { status: "insufficient" as const, observations: obs.length, triggered: n, message: "Insufficient observations for this analysis", disclaimer: DISCLAIMER };
  let cum = 0, peak = 0, maxDd = 0, pos = 0, neg = 0, longestPos = 0, longestNeg = 0, prob = 0, hit = 0; const resid: number[] = [], path: number[] = [];
  hits.forEach((o, i) => { const h = happened(o, rule.outcome), p = stated(o, rule.outcome); prob += p; hit += +h; const e = (h ? 1 : 0) - p; resid.push(e); cum += e; peak = Math.max(peak, cum); maxDd = Math.max(maxDd, peak - cum); if (e >= 0) { pos++; neg = 0; } else { neg++; pos = 0; } longestPos = Math.max(longestPos, pos); longestNeg = Math.max(longestNeg, neg); if (i % Math.ceil(n / 200) === 0) path.push(Math.round(cum * 100) / 100); });
  const m = resid.reduce((a, b) => a + b, 0) / n, sd = Math.sqrt(resid.reduce((a, b) => a + (b - m) ** 2, 0) / (n - 1)), avgP = prob / n, rate = hit / n, se = Math.sqrt(avgP * (1 - avgP) / n);
  return { status: "ok" as const, data: "synthetic" as const, observations: obs.length, triggered: n, triggerRate: Math.round((n / obs.length) * 10000) / 10000, outcome: rule.outcome, hitRate: Math.round(rate * 10000) / 10000, averageStatedProbability: Math.round(avgP * 10000) / 10000, gap: Math.round((rate - avgP) * 10000) / 10000, gapStandardErrors: Math.round(((rate - avgP) / (se || 1)) * 100) / 100,
    cumulativeScore: Math.round(cum * 100) / 100, maxDrawdown: Math.round(maxDd * 100) / 100, longestAboveStated: longestPos, longestBelowStated: longestNeg, volatility: Math.round(sd * 10000) / 10000, scorePath: path,
    limitations: ["Synthetic data generated from the same ratings used to state the chances, so a large gap is a sign of chance, not insight.", "Conditions were chosen after seeing the setup; rules tried many times will look good by luck.", "Not a prediction of real matches."], disclaimer: DISCLAIMER };
}
export const seedFor = (s: string) => makeRng(s)();
