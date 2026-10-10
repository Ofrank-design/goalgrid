import { LEAGUE_REGISTRY } from "@/lib/football/league-registry";
export const LEAGUES: [string, string][] = LEAGUE_REGISTRY.filter((l) => l.kind === "league").map((l) => [l.slug, l.name]);

export const formatLabel = (value: string) =>
  value
    .split("-")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");

export const formatPercent = (value: number, digits = 1) =>
  `${(value * 100).toFixed(digits)}%`;
