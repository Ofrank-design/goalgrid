import type { HistMatch } from "../../../types/prediction";
export interface Strengths { att: Map<string, number>; def: Map<string, number>; muH: number; muA: number; games: Map<string, number> }
/** Time-weighted attack and defence strengths, fitted iteratively and shrunk toward the league average. */
export function fitStrengths(hist: HistMatch[], now: Date, halfLifeDays: number, shrinkK = 3): Strengths | null {
  if (hist.length < 30) return null;
  const w = hist.map(m => Math.pow(0.5, Math.max(0, (now.getTime() - Date.parse(m.date)) / 86_400_000) / halfLifeDays));
  let sw = 0, sh = 0, sa = 0; hist.forEach((m, i) => { sw += w[i]; sh += w[i] * m.hg; sa += w[i] * m.ag; });
  const muH = sh / sw, muA = sa / sw, teams = [...new Set(hist.flatMap(m => [m.home, m.away]))];
  const att = new Map(teams.map(t => [t, 1])), def = new Map(teams.map(t => [t, 1])), W = new Map(teams.map(t => [t, 0])), games = new Map(teams.map(t => [t, 0]));
  hist.forEach((m, i) => { W.set(m.home, W.get(m.home)! + w[i]); W.set(m.away, W.get(m.away)! + w[i]); games.set(m.home, games.get(m.home)! + 1); games.set(m.away, games.get(m.away)! + 1); });
  for (let it = 0; it < 30; it++) {
    const nA = new Map<string, number>(), dA = new Map<string, number>(), nD = new Map<string, number>(), dD = new Map<string, number>();
    const add = (m: Map<string, number>, k: string, v: number) => m.set(k, (m.get(k) ?? 0) + v);
    hist.forEach((m, i) => {
      add(nA, m.home, w[i] * m.hg); add(dA, m.home, w[i] * muH * def.get(m.away)!); add(nA, m.away, w[i] * m.ag); add(dA, m.away, w[i] * muA * def.get(m.home)!);
      add(nD, m.home, w[i] * m.ag); add(dD, m.home, w[i] * muA * att.get(m.away)!); add(nD, m.away, w[i] * m.hg); add(dD, m.away, w[i] * muH * att.get(m.home)!);
    });
    let sa2 = 0, sd2 = 0;
    for (const t of teams) { att.set(t, (nA.get(t) ?? 0) / Math.max(dA.get(t) ?? 0, 1e-9) || 1); def.set(t, (nD.get(t) ?? 0) / Math.max(dD.get(t) ?? 0, 1e-9) || 1); sa2 += att.get(t)!; sd2 += def.get(t)!; }
    for (const t of teams) { att.set(t, att.get(t)! / (sa2 / teams.length)); def.set(t, def.get(t)! / (sd2 / teams.length)); }
  }
  const K = shrinkK; for (const t of teams) { const k = W.get(t)!; att.set(t, (att.get(t)! * k + K) / (k + K)); def.set(t, (def.get(t)! * k + K) / (k + K)); }
  return { att, def, muH, muA, games };
}
export const lambdas = (s: Strengths, h: string, a: string) => (s.att.has(h) && s.att.has(a)) ? { lh: s.muH * s.att.get(h)! * s.def.get(a)!, la: s.muA * s.att.get(a)! * s.def.get(h)! } : null;
