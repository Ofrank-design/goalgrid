import { makeRng, poissonSample } from "./rng";
import { GOALGRID_LIMITS } from "../control/limits";
/** Monte Carlo over a hypothetical double round robin. Expected goals per fixture come from the team strength model; the seasons are synthetic and are not forecasts of the real table. */
export interface SeasonInput { teams: string[]; rates: (home: string, away: string) => { lh: number; la: number } | null }
export interface TeamOutcome { team: string; expectedPoints: number; averagePosition: number; title: number; topFour: number; relegation: number; positions: number[] }
export function simulateSeasons(inp: SeasonInput, seasons: number, seed: string, o: { topN?: number; relegated?: number; maxRuntimeMs?: number } = {}): { seed: string; seasons: number; teams: TeamOutcome[] } | null {
  if (!Number.isInteger(seasons) || seasons < 1 || seasons > GOALGRID_LIMITS.simulation.maxIterations) throw new Error(`Season simulation limit exceeded (max ${GOALGRID_LIMITS.simulation.maxIterations}).`);
  const T = inp.teams, n = T.length, topN = o.topN ?? 4, rel = o.relegated ?? 3, r = makeRng(seed), started = Date.now(), maxRuntimeMs = o.maxRuntimeMs ?? Number.POSITIVE_INFINITY, rate: { lh: number; la: number }[][] = [];
  for (let i = 0; i < n; i++) { rate.push([]); for (let j = 0; j < n; j++) { if (i === j) { rate[i].push({ lh: 0, la: 0 }); continue; } const x = inp.rates(T[i], T[j]); if (!x) return null; rate[i].push(x); } }
  const pos = T.map(() => new Array(n).fill(0)), pts = new Array(n).fill(0);
  for (let s = 0; s < seasons; s++) { if (Date.now() - started > maxRuntimeMs) throw new Error("Simulation runtime limit exceeded");
    const P = new Array(n).fill(0), GD = new Array(n).fill(0), GF = new Array(n).fill(0);
    for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) { if (i === j) continue; const hg = poissonSample(r, rate[i][j].lh), ag = poissonSample(r, rate[i][j].la); GD[i] += hg - ag; GD[j] += ag - hg; GF[i] += hg; GF[j] += ag; if (hg > ag) P[i] += 3; else if (hg === ag) { P[i]++; P[j]++; } else P[j] += 3; }
    const tie = T.map(() => r()), order = T.map((_, i) => i).sort((a, b) => P[b] - P[a] || GD[b] - GD[a] || GF[b] - GF[a] || tie[a] - tie[b]);
    order.forEach((t, p) => { pos[t][p]++; pts[t] += P[t]; });
  }
  const f = (x: number) => Math.round((x / seasons) * 10000) / 10000;
  return { seed, seasons, teams: T.map((team, i) => ({ team, expectedPoints: Math.round((pts[i] / seasons) * 10) / 10, averagePosition: Math.round(pos[i].reduce((a, c, p) => a + c * (p + 1), 0) / seasons * 100) / 100, title: f(pos[i][0]), topFour: f(pos[i].slice(0, topN).reduce((a, b) => a + b, 0)), relegation: f(pos[i].slice(n - rel).reduce((a, b) => a + b, 0)), positions: pos[i].map(f) })).sort((a, b) => b.expectedPoints - a.expectedPoints) };
}
