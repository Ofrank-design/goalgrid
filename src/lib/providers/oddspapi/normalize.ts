import type { OddsEvent } from "../../../types/context";
export interface OpOutcome { players?: Record<string, { active?: boolean; price?: number; bookmakerOutcomeId?: string }> }
export interface OpFixture { fixtureId: string; participant1Id: number; participant2Id: number; startTime: string; hasOdds?: boolean;
  bookmakerOdds?: Record<string, { bookmakerIsActive?: boolean; suspended?: boolean; markets?: Record<string, { marketActive?: boolean; outcomes?: Record<string, OpOutcome> }> }> }
const price = (o: OpOutcome | undefined) => { const p = Object.values(o?.players ?? {}).find(x => x.active !== false && typeof x.price === "number" && x.price > 1); return p ? { price: p.price as number, label: (p.bookmakerOutcomeId ?? "").toLowerCase() } : null; };
/** Turns OddsPapi fixtures into the same event shape as The Odds API, so one market builder serves both.
 *  The full time result market is found by its labels (home, draw, away) and the goals market by "2.5/over" and "2.5/under", not by market ids. */
export function normalizeOddsPapi(fixtures: OpFixture[], names: Record<string, string>): OddsEvent[] {
  const out: OddsEvent[] = [];
  for (const f of fixtures) {
    const home = names[String(f.participant1Id)], away = names[String(f.participant2Id)]; if (!home || !away) continue;
    const bookmakers: OddsEvent["bookmakers"] = [];
    for (const [key, b] of Object.entries(f.bookmakerOdds ?? {})) {
      if (b.bookmakerIsActive === false || b.suspended) continue; const markets: OddsEvent["bookmakers"][number]["markets"] = [];
      for (const mk of Object.values(b.markets ?? {})) {
        if (mk.marketActive === false) continue; const outs = Object.values(mk.outcomes ?? {}).map(price).filter((x): x is { price: number; label: string } => !!x);
        const by = (l: string) => outs.find(o => o.label === l);
        if (outs.length === 3 && by("home") && by("draw") && by("away")) markets.push({ key: "h2h", outcomes: [{ name: home, price: by("home")!.price }, { name: "Draw", price: by("draw")!.price }, { name: away, price: by("away")!.price }] });
        else if (by("2.5/over") && by("2.5/under") && !markets.some(m => m.key === "totals")) markets.push({ key: "totals", outcomes: [{ name: "Over", price: by("2.5/over")!.price, point: 2.5 }, { name: "Under", price: by("2.5/under")!.price, point: 2.5 }] });
      }
      if (markets.length) bookmakers.push({ key, title: key, last_update: "", markets });
    }
    if (bookmakers.length) out.push({ id: f.fixtureId, sport_key: "soccer", commence_time: f.startTime, home_team: home, away_team: away, bookmakers });
  }
  return out;
}
