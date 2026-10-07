import { makeRng, poissonSample, sampleScore } from "./rng";
import { GOALGRID_LIMITS } from "../control/limits";
/** One synthetic match. The final score is drawn from the baseline score matrix; the events, statistics and clock are generated to agree with it. Everything is hypothetical and labelled so. */
export type EventType = "substitution" | "goal" | "shot_on_target" | "shot" | "corner" | "yellow" | "red" | "half_time" | "full_time";
export interface SimEvent { seq: number; t: number; label: string; type: EventType; team: "home" | "away" | null; score: { home: number; away: number }; x?: number; y?: number }
export interface TeamStats { substitutions: number; shots: number; shotsOnTarget: number; corners: number; yellow: number; red: number; possession: number }
export interface LiveProb { minute: number; home: number; draw: number; away: number }
export interface MatchSim { seed: string; final: { home: number; away: number }; expectedGoals: { home: number; away: number }; events: SimEvent[]; stats: { home: TeamStats; away: TeamStats }; liveProbabilities: LiveProb[]; momentum: { from: number; value: number }[]; addedTime: number }
const lab = (t: number, add: number) => (t <= 90 ? `${Math.max(1, Math.round(t))}'` : `90+${Math.min(add, Math.round(t - 90))}'`);
/** Chance of each result from the score and the time left, using Poisson goals for the remaining share of the match. */
export function liveProbs(sh: number, sa: number, lhRem: number, laRem: number): { home: number; draw: number; away: number } {
  const N = 12, ph = Array.from({ length: N }, (_, k) => Math.exp(-lhRem) * Math.pow(lhRem, k) / fact(k)), pa = Array.from({ length: N }, (_, k) => Math.exp(-laRem) * Math.pow(laRem, k) / fact(k)); let h = 0, d = 0, a = 0;
  for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) { const w = ph[i] * pa[j], diff = sh + i - (sa + j); if (diff > 0) h += w; else if (diff === 0) d += w; else a += w; }
  const s = h + d + a; return { home: h / s, draw: d / s, away: a / s };
}
const fact = (n: number) => { let f = 1; for (let i = 2; i <= n; i++) f *= i; return f; };
export function simulateMatch(M: number[][], xg: { home: number; away: number }, seed: string): MatchSim {
  const r = makeRng(seed), [hg, ag] = sampleScore(M, r()), goals = { home: hg, away: ag }, added = 2 + Math.floor(r() * 5), raw: { t: number; type: EventType; team: "home" | "away"; x?: number; y?: number }[] = [];
  const minute = () => (r() < 0.07 ? 90 + 1 + Math.floor(r() * added) : 1 + Math.floor(r() * 90)), stats = {} as { home: TeamStats; away: TeamStats };
  // Goal timing is sampled first so later events can react to the live score state.
  const goalTimes: { t: number; team: "home" | "away" }[] = [];
  for (const team of ["home", "away"] as const) for (let i = 0; i < goals[team]; i++) goalTimes.push({ t: minute(), team });
  const scoreBefore = (t: number) => { let h = 0, a = 0; for (const g of goalTimes) { if (g.t < t) { if (g.team === "home") h++; else a++; } } return { home: h, away: a }; };
  const pressureMultiplier = (team: "home" | "away", t: number) => {
    const sc = scoreBefore(t), own = team === "home" ? sc.home : sc.away, opp = team === "home" ? sc.away : sc.home;
    const state = own < opp ? 1.25 : own > opp ? 0.82 : 1;
    const latePush = own < opp && t >= 70 ? 1.15 : own > opp && t >= 80 ? 0.9 : 1;
    return state * latePush;
  };
  /** Pitch position (0 to 100, home attacks to the right). Goals come from close to goal, shots from the attacking third, corners from the flag. Positions are synthetic. */
  const place = (type: EventType): [number, number] => type === "goal" ? [90 + r() * 8, 38 + r() * 24] : type === "shot_on_target" ? [72 + r() * 24, 28 + r() * 44] : type === "shot" ? [66 + r() * 28, 15 + r() * 70] : type === "corner" ? [100, r() < 0.5 ? 0 : 100] : [0, 0];
  const push = (type: EventType, team: "home" | "away", t = minute()) => { const [x, y] = place(type), pos = type === "yellow" || type === "red" || type === "substitution" ? {} : { x: Math.round((team === "home" ? x : 100 - x) * 10) / 10, y: Math.round(y * 10) / 10 }; raw.push({ t, type, team, ...pos }); };
  for (const team of ["home", "away"] as const) {
    const g = goals[team], x = Math.max(xg[team], 0.3);
    goalTimes.filter(gx => gx.team === team).forEach(gx => push("goal", team, gx.t));
    // Trailing teams generate more attacking actions, especially late; leading teams protect the state.
    let nonGoalShots = 0, nonGoalOnTarget = 0, corners = 0;
    const buckets: [number, number][] = [[1, 30], [31, 60], [61, 90]];
    for (const [from, to] of buckets) {
      const pm = pressureMultiplier(team, (from + to) / 2), share = 1 / buckets.length;
      const off = poissonSample(r, x * 5 * share * pm), on = poissonSample(r, x * 2.4 * share * pm);
      nonGoalShots += off; nonGoalOnTarget += on;
      for (let i = 0; i < on; i++) push("shot_on_target", team, from + Math.floor(r() * (to - from + 1)));
      for (let i = 0; i < off; i++) push("shot", team, from + Math.floor(r() * (to - from + 1)));
      corners += poissonSample(r, (off + on) * 0.4 * pm);
    }
    const shots = g + nonGoalOnTarget + nonGoalShots, pmLate = pressureMultiplier(team, 82), yellow = poissonSample(r, 1.8 * (pmLate > 1.2 ? 1.05 : 1)), red = r() < 0.05 ? 1 : 0;
    for (let i = 0; i < corners; i++) push("corner", team); for (let i = 0; i < yellow; i++) push("yellow", team); if (red) push("red", team);
    const subs = 3 + Math.floor(r() * 3); for (let i = 0; i < subs; i++) push("substitution", team, 46 + Math.floor(r() * 40));
    stats[team] = { substitutions: subs, shots, shotsOnTarget: g + nonGoalOnTarget, corners, yellow, red, possession: 0 };
  }
  const shareH = xg.home / (xg.home + xg.away || 1), ph = Math.round(Math.min(70, Math.max(30, 50 + 36 * (shareH - 0.5) + (r() - 0.5) * 6))); stats.home.possession = ph; stats.away.possession = 100 - ph;
  raw.sort((a, b) => a.t - b.t); const ordered: { t: number; type: EventType; team: "home" | "away" | null; x?: number; y?: number }[] = [];
  let ht = false; for (const e of raw) { if (!ht && e.t > 45) { ordered.push({ t: 45, type: "half_time", team: null }); ht = true; } ordered.push(e); } if (!ht) ordered.push({ t: 45, type: "half_time", team: null }); ordered.push({ t: 90 + added, type: "full_time", team: null });
  let sh = 0, sa = 0; const events: SimEvent[] = ordered.map((e, i) => { if (e.type === "goal") { if (e.team === "home") sh++; else sa++; } return { seq: i + 1, t: e.t, label: e.type === "half_time" ? "45'" : e.type === "full_time" ? lab(e.t, added) : lab(e.t, added), type: e.type, team: e.team, score: { home: sh, away: sa }, ...(e.x != null ? { x: e.x, y: e.y } : {}) }; });
  const live = deriveLive(events, xg), momentum = deriveMomentum(events);
  return { seed, final: goals, expectedGoals: xg, events, stats, liveProbabilities: live, momentum, addedTime: added };
}
const round3 = (p: { home: number; draw: number; away: number }) => ({ home: Math.round(p.home * 1000) / 1000, draw: Math.round(p.draw * 1000) / 1000, away: Math.round(p.away * 1000) / 1000 });
export function scoreAt(events: SimEvent[], t: number): { home: number; away: number } { let s = { home: 0, away: 0 }; for (const e of events) { if (e.t <= t) s = e.score; else break; } return s; }
/** Repeats the match many times from one seed and counts results. The sampling error is reported so a count is never mistaken for a certainty. */
export function runMany(M: number[][], n: number, seed: string, maxRuntimeMs = Number.POSITIVE_INFINITY) {
  if (!Number.isInteger(n) || n < 1 || n > GOALGRID_LIMITS.simulation.maxIterations) throw new Error(`Simulation iteration limit exceeded (max ${GOALGRID_LIMITS.simulation.maxIterations}).`);
  const r = makeRng(seed), counts = { home: 0, draw: 0, away: 0 }, scores = new Map<string, number>(); let btts = 0, over = 0, gh = 0, ga = 0;
  const started = Date.now();
  for (let i = 0; i < n; i++) { if (Date.now() - started > maxRuntimeMs) throw new Error("Simulation runtime limit exceeded"); const [h, a] = sampleScore(M, r()); if (h > a) counts.home++; else if (h === a) counts.draw++; else counts.away++; if (h > 0 && a > 0) btts++; if (h + a > 2) over++; gh += h; ga += a; const k = `${h}-${a}`; scores.set(k, (scores.get(k) ?? 0) + 1); }
  const pr = (c: number) => ({ count: c, probability: Math.round((c / n) * 10000) / 10000, margin: Math.round(1.96 * Math.sqrt(((c / n) * (1 - c / n)) / n) * 10000) / 10000 });
  return { runs: n, seed, home: pr(counts.home), draw: pr(counts.draw), away: pr(counts.away), btts: pr(btts), over25: pr(over), averageGoals: { home: Math.round((gh / n) * 100) / 100, away: Math.round((ga / n) * 100) / 100 }, topScores: [...scores.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8).map(([score, c]) => ({ score, ...pr(c) })) };
}

/** Live chances for every minute, from the score and the share of the match left. Uses only what has happened by that minute. */
export function deriveLive(events: SimEvent[], xg: { home: number; away: number }): LiveProb[] {
  const out: LiveProb[] = []; for (let m = 0; m <= 90; m++) { const s = scoreAt(events, m + 0.999), f = (90 - m) / 90; out.push({ minute: m, ...round3(liveProbs(s.home, s.away, xg.home * f, xg.away * f)) }); } return out;
}
/** Pressure in five minute blocks: positive favours the home side. Goals count most, then shots on target, shots and corners. */
export function deriveMomentum(events: SimEvent[]): { from: number; value: number }[] {
  const w: Partial<Record<EventType, number>> = { goal: 3, shot_on_target: 2, shot: 1, corner: 0.5 }, out: { from: number; value: number }[] = [];
  for (let b = 0; b < 90; b += 5) out.push({ from: b, value: Math.round(events.filter(e => e.team && w[e.type] && e.t >= b && e.t < b + 5).reduce((a, e) => a + (e.team === "home" ? 1 : -1) * w[e.type]!, 0) * 10) / 10 });
  return out;
}
