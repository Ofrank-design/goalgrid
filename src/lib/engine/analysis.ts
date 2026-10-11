import type { Match } from "../../types/football";
import type { Prediction, PredictionAnalysis, StreakContext, TeamFormContext, VenueContext } from "../../types/prediction";

/**
 * A plain-language read of one prediction, built only from numbers the engine already holds: the probabilities, expected goals, both
 * teams' form, current runs, ground records and past meetings. It needs no language-model call, so every fixture gets it. Short, active
 * sentences; it never claims certainty.
 */
const fin = (x: number) => (Number.isFinite(x) ? x : 0), pc = (x: number) => `${Math.round(fin(x) * 100)}%`;
const per = (total: number, games: number) => (games > 0 ? (total / games).toFixed(1) : null);
const formLine = (name: string, f: TeamFormContext) => (f.played ? `${name}: ${f.form} (${f.goalsFor} scored, ${f.goalsAgainst} conceded in ${f.played}).` : `${name}: no recent matches in the history.`);

function runLines(name: string, s?: StreakContext): string[] {
  if (!s) return [];
  const out: string[] = [];
  if (s.wins >= 2) out.push(`${name} have won their last ${s.wins}.`); else if (s.unbeaten >= 4) out.push(`${name} are unbeaten in ${s.unbeaten}.`);
  else if (s.losses >= 2) out.push(`${name} have lost their last ${s.losses}.`); else if (s.winless >= 4) out.push(`${name} are winless in ${s.winless}.`);
  if (s.scoredIn >= 4) out.push(`${name} have scored in ${s.scoredIn} games in a row.`);
  if (s.cleanSheets >= 2) out.push(`${name} have kept ${s.cleanSheets} clean sheets in a row.`);
  return out;
}
const venueLine = (name: string, where: string, v?: VenueContext) => (v && v.played >= 3 ? `${name} ${where}: ${v.wins}W ${v.draws}D ${v.losses}L, ${per(v.goalsFor, v.played)} scored and ${per(v.goalsAgainst, v.played)} conceded per game.` : null);

export function analysisOf(match: Match, p: Prediction): PredictionAnalysis {
  const home = match.home.name, away = match.away.name, pr = p.probabilities, lead = Math.max(pr.home, pr.draw, pr.away), c = p.context;
  const side = lead === pr.home ? `${home} are favoured with a ${pc(lead)} chance to win.` : lead === pr.away ? `${away} are favoured with a ${pc(lead)} chance to win.` : `A draw is the single likeliest result at ${pc(lead)}.`;
  const summary = [lead < 0.4 ? `This match looks open: ${home} ${pc(pr.home)}, draw ${pc(pr.draw)}, ${away} ${pc(pr.away)}.` : side,
    `The models expect ${fin(p.expectedGoals.home).toFixed(1)} to ${fin(p.expectedGoals.away).toFixed(1)} goals. Over 2.5 goals has a ${pc(p.over25)} chance. Both teams score at ${pc(p.btts)}.`].join(" ");

  const form = c ? [formLine(home, c.homeForm), formLine(away, c.awayForm), ...runLines(home, c.homeStreak), ...runLines(away, c.awayStreak), venueLine(home, "at home", c.homeAtHome), venueLine(away, "away", c.awayAway),
    c.h2h.meetings ? `Head to head, last ${c.h2h.meetings}: ${home} ${c.h2h.homeWins} wins, ${c.h2h.draws} draws, ${away} ${c.h2h.awayWins} wins.` : "These clubs have no past meetings in the model history."].filter(Boolean).join(" ")
    : "No team history was available for this fixture.";

  const hh = c?.homeAtHome, aa = c?.awayAway, total = fin(p.expectedGoals.home) + fin(p.expectedGoals.away);
  const lean = p.over25 >= 0.5 ? "lean to over 2.5 goals" : "lean to under 2.5 goals";
  const tactical = hh && aa && hh.played >= 3 && aa.played >= 3
    ? `${home} score ${per(hh.goalsFor, hh.played)} per home game and ${away} concede ${per(aa.goalsAgainst, aa.played)} per away game. ${away} score ${per(aa.goalsFor, aa.played)} per away game and ${home} concede ${per(hh.goalsAgainst, hh.played)} per home game. The models expect ${total.toFixed(1)} goals, so they ${lean}. This reads goals only, not tactics.`
    : `No ground-by-ground record is available, so this uses league averages. The models expect ${total.toFixed(1)} goals and ${lean}.`;

  const notes: string[] = [];
  if (p.baseline) notes.push(p.note ?? "This is a baseline estimate from league averages.");
  notes.push(p.baseline ? `Evidence is low (${p.confidence}/100).` : `Evidence is ${p.confidence}/100. That score reflects how closely the models agree and how much history exists. It is not the chance of being right.`);
  if (!p.baseline && lead >= 0.55 && p.confidence < 75) notes.push("The win chance is high, but the evidence is only moderate.");
  if (!p.baseline && fin(p.agreement) < 0.8) notes.push("The models disagree more than usual.");
  if (!p.baseline && fin(p.dataQuality) < 0.6) notes.push("At least one team has few recent matches in the history.");
  if (p.marketGap != null && p.marketGap >= 0.08) notes.push(`Bookmaker odds differ from the models by up to ${Math.round(p.marketGap * 100)} points.`);
  notes.push("Starting line-ups can change this. These are probabilities, not guarantees.");
  return { summary, form, tactical, uncertainty: notes.join(" ") };
}
