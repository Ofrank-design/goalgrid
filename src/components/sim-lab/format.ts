export const LEAGUES: [string, string][] = [
  ["premier-league", "Premier League"],
  ["la-liga", "La Liga"],
  ["serie-a", "Serie A"],
  ["bundesliga", "Bundesliga"],
  ["ligue-1", "Ligue 1"],
];

export const formatLabel = (value: string) =>
  value
    .split("-")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");

export const formatPercent = (value: number, digits = 1) =>
  `${(value * 100).toFixed(digits)}%`;
