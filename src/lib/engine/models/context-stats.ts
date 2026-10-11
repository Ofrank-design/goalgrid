import type { HistMatch } from "../../../types/prediction";

/** Team form and head-to-head, read straight from the league history the models are fitted on. Pure functions, no provider calls, never NaN. */
export interface TeamFormSummary { form: string; played: number; goalsFor: number; goalsAgainst: number; points: number }
export interface H2HMeeting { date: string; home: string; away: string; hg: number; ag: number }
/** Record of the fixture's home team (`home`) against the away team (`away`) over past meetings at either ground. */
export interface H2HSummary { meetings: number; homeWins: number; draws: number; awayWins: number; last: H2HMeeting[] }

const byDate = (h: HistMatch[]) => [...h].sort((a, b) => a.date.localeCompare(b.date));

/** Last `n` results for a team, oldest to newest ("WWDLW"), with goals and points over those matches. */
export function teamFormOf(history: HistMatch[], team: string, n = 5): TeamFormSummary {
  const games = byDate(history).filter(m => m.home === team || m.away === team).slice(-n);
  let form = "", gf = 0, ga = 0, points = 0;
  for (const m of games) {
    const f = m.home === team ? m.hg : m.ag, a = m.home === team ? m.ag : m.hg;
    gf += f; ga += a; if (f > a) { form += "W"; points += 3; } else if (f === a) { form += "D"; points += 1; } else form += "L";
  }
  return { form, played: games.length, goalsFor: gf, goalsAgainst: ga, points };
}

/** Past meetings of two teams (either ground), newest last, with the record from the fixture home team's point of view. */
export function headToHeadOf(history: HistMatch[], home: string, away: string, n = 6): H2HSummary {
  const all = byDate(history).filter(m => (m.home === home && m.away === away) || (m.home === away && m.away === home)), recent = all.slice(-n);
  let homeWins = 0, draws = 0, awayWins = 0;
  for (const m of recent) { const mine = m.home === home ? m.hg : m.ag, theirs = m.home === home ? m.ag : m.hg; if (mine > theirs) homeWins++; else if (mine === theirs) draws++; else awayWins++; }
  return { meetings: recent.length, homeWins, draws, awayWins, last: recent.map(m => ({ date: m.date, home: m.home, away: m.away, hg: m.hg, ag: m.ag })) };
}

/** Current runs, counted back from the team's latest match. */
export interface StreakSummary { wins: number; unbeaten: number; losses: number; winless: number; scoredIn: number; cleanSheets: number }
export function streakOf(history: HistMatch[], team: string): StreakSummary {
  const games = byDate(history).filter(m => m.home === team || m.away === team).reverse();
  const run = (keep: (f: number, a: number) => boolean) => { let n = 0; for (const m of games) { const f = m.home === team ? m.hg : m.ag, a = m.home === team ? m.ag : m.hg; if (!keep(f, a)) break; n++; } return n; };
  return { wins: run((f, a) => f > a), unbeaten: run((f, a) => f >= a), losses: run((f, a) => f < a), winless: run((f, a) => f <= a), scoredIn: run(f => f > 0), cleanSheets: run((_, a) => a === 0) };
}

/** A team's record at one ground only (all its home games, or all its away games), last `n` of them. */
export interface VenueSummary { played: number; wins: number; draws: number; losses: number; goalsFor: number; goalsAgainst: number }
export function venueOf(history: HistMatch[], team: string, venue: "home" | "away", n = 8): VenueSummary {
  const games = byDate(history).filter(m => (venue === "home" ? m.home : m.away) === team).slice(-n);
  const out: VenueSummary = { played: games.length, wins: 0, draws: 0, losses: 0, goalsFor: 0, goalsAgainst: 0 };
  for (const m of games) { const f = venue === "home" ? m.hg : m.ag, a = venue === "home" ? m.ag : m.hg; out.goalsFor += f; out.goalsAgainst += a; if (f > a) out.wins++; else if (f === a) out.draws++; else out.losses++; }
  return out;
}
