import type { TeamStats } from "./match";
/** Plain statements built only from numbers the simulation produced. It describes what happened and how likely the model thought it was; it does not invent causes. */
export function explainResult(o: { home: string; away: string; final: { home: number; away: number }; stats: { home: TeamStats; away: TeamStats }; xg: { home: number; away: number }; chances: { home: number; draw: number; away: number } }): string[] {
  const { home, away, final: f, stats: s, xg, chances: c } = o, res = f.home > f.away ? "home" : f.home < f.away ? "away" : "draw", p = c[res], pct = Math.round(p * 100), lines: string[] = [];
  lines.push(`${home} ${f.home} – ${f.away} ${away}. Before kickoff the model gave this kind of result about ${pct}% of the time${p < 0.2 ? ", so it was an unlikely outcome" : p > 0.45 ? ", so it was the most expected outcome" : ", so it was not unusual"}.`);
  lines.push(`Expected goals going in were ${xg.home.toFixed(2)} for ${home} and ${xg.away.toFixed(2)} for ${away}. The simulated score was ${f.home + f.away > xg.home + xg.away + 1 ? "well above" : f.home + f.away < xg.home + xg.away - 1 ? "well below" : "close to"} that total.`);
  lines.push(`Shots: ${home} ${s.home.shots} (${s.home.shotsOnTarget} on target), ${away} ${s.away.shots} (${s.away.shotsOnTarget} on target). Possession ${s.home.possession}% to ${s.away.possession}%.`);
  const conv = (g: number, sot: number) => (sot ? Math.round((g / sot) * 100) : 0); lines.push(`Of their shots on target, ${home} scored ${conv(f.home, s.home.shotsOnTarget)}% and ${away} ${conv(f.away, s.away.shotsOnTarget)}%.`);
  if (s.home.red + s.away.red > 0) lines.push(`A red card was shown (${s.home.red ? home : away}), which this simulation records but does not use to change the live chances.`);
  lines.push("Shot counts, cards and possession are synthetic details generated to fit the simulated score. They illustrate a match; they are not measured data.");
  return lines;
}
