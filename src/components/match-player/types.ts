import type { MatchSim } from "@/lib/simulation/match";

export type Speed = 1 | 2 | 4;

export interface Extra {
  baseline?: { home: number; draw: number; away: number };
}

export type ProbabilityPoint = {
  t: number;
  home: number;
  draw: number;
  away: number;
};

export type Banner = {
  id: number;
  text: string;
  detail: string | null;
  until: number;
};

export type MatchPlayerProps = {
  sim: MatchSim & Extra;
  homeSlug: string;
  awaySlug: string;
  autoplay?: boolean;
};
