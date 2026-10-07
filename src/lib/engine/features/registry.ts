/** Every input the history models read, with when it becomes known. A feature that is only known after the match can never be used to price that match, and a test enforces this. */
export type Availability = "pre-match" | "kickoff-time" | "post-match";
export interface FeatureSpec { index: number; name: string; source: string; availableAt: Availability; window: string; note: string }
export const FEATURES: FeatureSpec[] = [
  { index: 0, name: "elo_gap", source: "results history", availableAt: "pre-match", window: "all earlier matches", note: "Elo including home advantage, updated after each earlier match" },
  { index: 1, name: "form_points_gap", source: "results history", availableAt: "pre-match", window: "last 5 matches per team", note: "Mean points per match, home minus away" },
  { index: 2, name: "form_goal_diff_gap", source: "results history", availableAt: "pre-match", window: "last 5 matches per team", note: "Mean goal difference, home minus away" },
  { index: 3, name: "rest_gap", source: "results history", availableAt: "kickoff-time", window: "days since each team's last match", note: "Needs the kickoff time of this match, which is known in advance" },
  { index: 4, name: "home_form_vs_away_form", source: "results history", availableAt: "pre-match", window: "last 5 home and last 5 away matches", note: "Home team's home points against away team's away points" },
  { index: 5, name: "expected_total_goals", source: "results history", availableAt: "pre-match", window: "last 5 matches per team", note: "Average total goals in both teams' recent matches" },
];
export const CONTEXT_FEATURES: { name: string; availableAt: Availability; rule: string }[] = [
  { name: "bookmaker_odds", availableAt: "pre-match", rule: "Use the snapshot taken before the freeze; never a closing line captured after kickoff" },
  { name: "weather_forecast", availableAt: "pre-match", rule: "Use the forecast, never the observed weather after the match" },
  { name: "news_sentiment", availableAt: "pre-match", rule: "Only articles published before the freeze" },
];
export const postMatchFeatures = () => [...FEATURES, ...CONTEXT_FEATURES].filter(f => f.availableAt === "post-match");
