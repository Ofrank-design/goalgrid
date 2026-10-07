import { makeRng, poissonSample } from "./rng";
/** A fictional league: invented clubs with invented ratings. Nothing here is a real club, and the names are generated, so results cannot be mistaken for official data. */
export interface FictionalTeam { name: string; attack: number; defence: number }
const PLACES = ["North", "Ash", "Red", "Stone", "Silver", "Iron", "Kings", "Lake", "Crown", "Harbour", "Oak", "Falcon", "Glen", "Marsh", "Bright", "Wolf", "Cedar", "Amber", "Frost", "River"], TAILS = ["vale", "field", "ford", "haven", "bridge", "port", "wick", "mere", "gate", "ton"], KINDS = ["United", "Athletic", "Rovers", "Town", "City", "Wanderers", "Albion", "Rangers"];
export function generateLeague(n: number, seed: string): FictionalTeam[] {
  const r = makeRng(`${seed}:teams`), used = new Set<string>(), out: FictionalTeam[] = [];
  while (out.length < n) { const name = `${PLACES[Math.floor(r() * PLACES.length)]}${TAILS[Math.floor(r() * TAILS.length)]} ${KINDS[Math.floor(r() * KINDS.length)]}`; if (used.has(name)) continue; used.add(name);
    const g = () => (r() + r() + r() - 1.5) / 1.5; out.push({ name, attack: Math.round(Math.exp(0.28 * g()) * 100) / 100, defence: Math.round(Math.exp(0.28 * g()) * 100) / 100 }); }
  return out;
}
export interface FictionalMatch { round: number; home: string; away: string; hg: number; ag: number; lh: number; la: number }
export interface Row { team: string; played: number; won: number; drawn: number; lost: number; gf: number; ga: number; gd: number; points: number }
/** Goals follow Poisson with rate goalRate * attack / opponent defence, plus a home advantage factor. Defence is a multiplier on the opponent's rate, so a higher defence number is weaker. */
export function rates(h: FictionalTeam, a: FictionalTeam, goalRate: number, homeAdv: number) { return { lh: goalRate * homeAdv * h.attack * a.defence, la: (goalRate / homeAdv) * a.attack * h.defence }; }
export function playSeason(teams: FictionalTeam[], seed: string, o: { goalRate?: number; homeAdvantage?: number } = {}): { matches: FictionalMatch[]; table: Row[] } {
  const r = makeRng(`${seed}:season`), g = o.goalRate ?? 1.35, ha = o.homeAdvantage ?? 1.2, matches: FictionalMatch[] = [], rows = new Map<string, Row>(teams.map(t => [t.name, { team: t.name, played: 0, won: 0, drawn: 0, lost: 0, gf: 0, ga: 0, gd: 0, points: 0 }]));
  const pairs: [number, number][] = []; for (let i = 0; i < teams.length; i++) for (let j = 0; j < teams.length; j++) if (i !== j) pairs.push([i, j]);
  for (let k = pairs.length - 1; k > 0; k--) { const j = Math.floor(r() * (k + 1)); [pairs[k], pairs[j]] = [pairs[j], pairs[k]]; }
  pairs.forEach(([i, j], idx) => { const h = teams[i], a = teams[j], { lh, la } = rates(h, a, g, ha), hg = poissonSample(r, lh), ag = poissonSample(r, la); matches.push({ round: Math.floor(idx / (teams.length / 2)) + 1, home: h.name, away: a.name, hg, ag, lh: Math.round(lh * 100) / 100, la: Math.round(la * 100) / 100 });
    const H = rows.get(h.name)!, A = rows.get(a.name)!; H.played++; A.played++; H.gf += hg; H.ga += ag; A.gf += ag; A.ga += hg; if (hg > ag) { H.won++; H.points += 3; A.lost++; } else if (hg < ag) { A.won++; A.points += 3; H.lost++; } else { H.drawn++; A.drawn++; H.points++; A.points++; } });
  const table = [...rows.values()].map(x => ({ ...x, gd: x.gf - x.ga })).sort((a, b) => b.points - a.points || b.gd - a.gd || b.gf - a.gf || a.team.localeCompare(b.team)); return { matches, table };
}
