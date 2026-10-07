import type { Match } from "../../../types/football";
import type { MarketSnapshot, OddsEvent, Triple } from "../../../types/context";
import { teamSlug } from "./teams";
export function findOddsEvent(events: OddsEvent[], m: Match): OddsEvent | undefined {
  const t = Date.parse(m.kickoffUtc);
  return events.find(e => teamSlug(e.home_team) === m.home.slug && teamSlug(e.away_team) === m.away.slug && Math.abs(Date.parse(e.commence_time) - t) <= 3 * 3_600_000);
}
const devig = (odds: number[]) => { const inv = odds.map(o => 1 / o), s = inv.reduce((a, b) => a + b, 0); return { p: inv.map(x => x / s), overround: s - 1 }; };
const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
const r4 = (x: number) => Math.round(x * 10_000) / 10_000;
export function buildMarket(e: OddsEvent, now = new Date(), ttlMs = 6 * 3_600_000): MarketSnapshot | null {
  const rows: { p: number[]; ov: number; best: number[] }[] = [], totals: number[][] = [];
  for (const b of e.bookmakers) {
    const h2h = b.markets.find(m => m.key === "h2h")?.outcomes, price = (n: string) => h2h?.find(o => o.name === n)?.price;
    const o = [price(e.home_team), price("Draw"), price(e.away_team)];
    if (o.every(x => typeof x === "number" && x > 1)) { const d = devig(o as number[]); rows.push({ p: d.p, ov: d.overround, best: o as number[] }); }
    const tot = b.markets.find(m => m.key === "totals")?.outcomes.filter(x => x.point === 2.5), ov = tot?.find(x => x.name === "Over")?.price, un = tot?.find(x => x.name === "Under")?.price;
    if (ov && un && ov > 1 && un > 1) totals.push(devig([ov, un]).p);
  }
  if (!rows.length) return null;
  const col = (i: number) => rows.map(r => r.p[i]), best = (i: number) => Math.max(...rows.map(r => r.best[i]));
  const tri = (f: (i: number) => number): Triple => ({ home: r4(f(0)), draw: r4(f(1)), away: r4(f(2)) });
  return { bookmakers: rows.length, impliedProbabilities: tri(i => mean(col(i))), bestOdds: tri(best), averageOverround: r4(mean(rows.map(r => r.ov))),
    goals25: totals.length ? { over: r4(mean(totals.map(t => t[0]))), under: r4(mean(totals.map(t => t[1]))) } : null,
    provenance: { source: "odds-api", retrievedAt: now.toISOString(), expiresAt: new Date(now.getTime() + ttlMs).toISOString() } };
}
