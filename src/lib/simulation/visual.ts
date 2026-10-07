import teamsJson from "../../content/teams-visual.json";
import { clubBySlug } from "../football/clubs";
import { hashSeed, makeRng } from "./rng";
import type { MatchSim, SimEvent } from "./match";
/** The visual layer. It reads the events the engine produced and decides how to draw them. It never changes a score, a statistic or a probability. Formations, build-up passes and shirt numbers here are illustrative: GoalGrid has no lineup or player data, so no player names are ever shown. */
export interface Pt { x: number; y: number }
export interface TeamVisual { slug: string; name: string; shortName: string; primary: string; secondary: string; crest: string | null }
const DATA = teamsJson as Record<string, { short: string; primary: string; secondary: string }>;
const hex = (h: string) => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16));
export const luminance = (h: string) => { const [r, g, b] = hex(h).map(v => { const c = v / 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; }); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
export const textOn = (bg: string) => (luminance(bg) > 0.45 ? "#0b0f1a" : "#ffffff");
export const colourDistance = (a: string, b: string) => { const A = hex(a), B = hex(b); return Math.sqrt(2 * (A[0] - B[0]) ** 2 + 4 * (A[1] - B[1]) ** 2 + 3 * (A[2] - B[2]) ** 2); };
const nice = (s: string) => s.split("-").map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
/** Colours, short name and crest come from data, never from the match. A team missing from the data gets a stable colour derived from its slug. */
export function teamVisual(slug: string): TeamVisual {
  const club = clubBySlug(slug), d = club ? DATA[club.key] : undefined;
  if (club && d) return { slug, name: club.name, shortName: d.short, primary: d.primary, secondary: d.secondary, crest: `/crests/${club.key}.webp` };
  const h = hashSeed(slug), hue = h % 360, hsl = (hh: number, l: number) => { const a = 0.6 * Math.min(l, 1 - l), f = (n: number) => { const k = (n + hh / 30) % 12, c = l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1)); return Math.round(255 * c).toString(16).padStart(2, "0"); }; return `#${f(0)}${f(8)}${f(4)}`; };
  return { slug, name: nice(slug), shortName: slug.replace(/[^a-z]/g, "").slice(0, 3).toUpperCase() || "TEA", primary: hsl(hue, 0.42), secondary: "#ffffff", crest: null };
}
/** If the two kits look alike, the away side switches to its second colour, or to a plain contrasting kit as a last resort. */
export function kits(home: TeamVisual, away: TeamVisual): { home: { fill: string; trim: string }; away: { fill: string; trim: string } } {
  const THRESH = 120; let af = away.primary, at = away.secondary;
  if (colourDistance(home.primary, af) < THRESH) { [af, at] = [away.secondary, away.primary]; if (colourDistance(home.primary, af) < THRESH) { af = luminance(home.primary) > 0.4 ? "#111827" : "#f8fafc"; at = away.primary; } }
  return { home: { fill: home.primary, trim: home.secondary }, away: { fill: af, trim: at } };
}
export type Role = "GK" | "RB" | "CB" | "LB" | "RWB" | "LWB" | "CDM" | "CM" | "AM" | "RM" | "LM" | "RW" | "LW" | "ST";
export interface Slot { role: Role; x: number; y: number }
export interface Formation { name: string; slots: Slot[] }
const S = (role: Role, x: number, y: number): Slot => ({ role, x, y });
/** Positions are in the team's own frame: 0 is its own goal line, 100 the opponent's, y runs from the left touchline (0) to the right (100) as the team faces forward. */
export const FORMATIONS: Formation[] = [
  { name: "4-3-3", slots: [S("GK", 5, 50), S("RB", 22, 85), S("CB", 20, 63), S("CB", 20, 37), S("LB", 22, 15), S("CDM", 35, 50), S("CM", 46, 66), S("CM", 46, 34), S("RW", 70, 85), S("ST", 76, 50), S("LW", 70, 15)] },
  { name: "4-2-3-1", slots: [S("GK", 5, 50), S("RB", 22, 85), S("CB", 20, 63), S("CB", 20, 37), S("LB", 22, 15), S("CDM", 36, 62), S("CDM", 36, 38), S("RW", 62, 84), S("AM", 60, 50), S("LW", 62, 16), S("ST", 76, 50)] },
  { name: "4-4-2", slots: [S("GK", 5, 50), S("RB", 22, 85), S("CB", 20, 63), S("CB", 20, 37), S("LB", 22, 15), S("RM", 46, 85), S("CM", 44, 62), S("CM", 44, 38), S("LM", 46, 15), S("ST", 72, 62), S("ST", 72, 38)] },
  { name: "3-5-2", slots: [S("GK", 5, 50), S("CB", 20, 72), S("CB", 18, 50), S("CB", 20, 28), S("RWB", 42, 92), S("CM", 42, 66), S("CM", 38, 50), S("CM", 42, 34), S("LWB", 42, 8), S("ST", 72, 60), S("ST", 72, 40)] },
  { name: "3-4-3", slots: [S("GK", 5, 50), S("CB", 20, 72), S("CB", 18, 50), S("CB", 20, 28), S("RM", 42, 85), S("CM", 42, 60), S("CM", 42, 40), S("LM", 42, 15), S("RW", 70, 82), S("ST", 76, 50), S("LW", 70, 18)] },
  { name: "5-3-2", slots: [S("GK", 5, 50), S("RWB", 30, 92), S("CB", 20, 72), S("CB", 18, 50), S("CB", 20, 28), S("LWB", 30, 8), S("CM", 44, 68), S("CM", 42, 50), S("CM", 44, 32), S("ST", 70, 60), S("ST", 70, 40)] },
];
const FIRST = [0, 1, 2, 4, 3, 5];
/** Illustrative formation chosen from the team slug. It is not the club's real formation. */
export const formationFor = (slug: string): Formation => FORMATIONS[FIRST[hashSeed(`formation:${slug}`) % 12 < 5 ? 0 : hashSeed(`formation:${slug}`) % FIRST.length] % FORMATIONS.length];
export type Phase = "attack" | "defend" | "counter" | "neutral";
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
/** Where each of a team's 11 players should stand. Formation sets the base; the ball pulls the shape toward it; possession pushes the team up or drops it back; a team that is behind late pushes forward and one that is ahead late sits deeper. Returned in pitch coordinates (home attacks right, away mirrored). */
export function positionsFor(f: Formation, side: "home" | "away", ball: Pt, phase: Phase, scoreDiff: number, minute: number): Pt[] {
  const own = side === "home" ? ball : { x: 100 - ball.x, y: 100 - ball.y }, late = minute > 70 ? (minute - 70) / 20 : 0, pressure = scoreDiff < 0 ? 6 * late : scoreDiff > 0 ? -4 * late : 0;
  const push = (phase === "attack" ? 9 : phase === "counter" ? 13 : phase === "defend" ? -7 : 0) + pressure;
  return f.slots.map(s => { let x = s.x, y = s.y;
    if (s.role === "GK") { x = 4 + (phase === "attack" ? 3 : 0); y = 50 + (own.y - 50) * 0.12; }
    else { const w = 0.4 + 0.6 * (s.x / 80); x = s.x + push * w; x += (own.x - x) * 0.16; y = s.y + (own.y - s.y) * (phase === "attack" ? 0.1 : 0.14); if (phase === "defend") y = 50 + (y - 50) * 0.88; }
    x = clamp(x, 3, 97); y = clamp(y, 3, 97); return side === "home" ? { x, y } : { x: 100 - x, y: 100 - y }; });
}
/** Shirt numbers by slot, then 12 to 16 for substitutes. */
export const shirtNumber = (i: number) => i + 1;
export interface Beat { seq: number; t: number; kind: "goal" | "shot_on_target" | "shot" | "corner" | "yellow" | "red" | "substitution"; team: "home" | "away"; path: Pt[]; durationMs: number; banner: string | null; detail: string | null; sub?: { slot: number; offRole: Role; offNumber: number; onNumber: number } }
export interface Spell { fromT: number; toT: number; team: "home" | "away"; path: Pt[] }
export type Segment = { type: "spell"; spell: Spell } | { type: "beat"; beat: Beat };
const DURATION: Record<Beat["kind"], number> = { goal: 3400, shot_on_target: 1700, shot: 1400, corner: 1500, yellow: 900, red: 1100, substitution: 1500 };
const toFrame = (p: Pt, side: "home" | "away"): Pt => (side === "home" ? p : { x: 100 - p.x, y: 100 - p.y });
/** Turns the engine's events into things to draw. Goals and shots get a short build-up of passes, then the strike from the event's own position. Substitutions pick a slot and number. Quiet stretches become possession spells weighted by the simulated possession share. Deterministic for a given match. */
export function choreograph(sim: MatchSim, home: Formation, away: Formation): Segment[] {
  const out: Segment[] = [], fh = home.slots.length, used = { home: new Set<number>(), away: new Set<number>() }, subs = { home: 0, away: 0 }; let last: { t: number; ball: Pt } = { t: 0, ball: { x: 50, y: 50 } };
  const spell = (fromT: number, toT: number, r: () => number) => { if (toT - fromT < 0.8) return; const team = r() * 100 < sim.stats.home.possession ? "home" : "away", n = 3 + Math.floor(r() * 4), path: Pt[] = [last.ball];
    for (let i = 0; i < n; i++) { const p = path[path.length - 1], dir = team === "home" ? 1 : -1; path.push({ x: clamp(p.x + dir * (r() * 14 - 4), 28, 72), y: clamp(p.y + (r() - 0.5) * 36, 10, 90) }); } out.push({ type: "spell", spell: { fromT, toT, team, path } }); last = { t: toT, ball: path[path.length - 1] }; };
  for (const e of sim.events) {
    if (!e.team || e.type === "half_time" || e.type === "full_time") continue; const r = makeRng(`${sim.seed}:vis:${e.seq}`), side = e.team, goalX = side === "home" ? 100 : 0; spell(last.t, e.t, r);
    const attack = (n: number, to: Pt): Pt[] => { const path: Pt[] = [], startX = 38 + r() * 12; for (let i = 0; i <= n; i++) { const k = i / n; path.push(toFrame({ x: startX + ((side === "home" ? to.x : 100 - to.x) - startX) * k + (r() - 0.5) * 6, y: 50 + ((side === "home" ? to.y : 100 - to.y) - 50) * k + (r() - 0.5) * 22 }, side)); } path[n] = to; return path; };
    if (e.type === "goal" || e.type === "shot_on_target" || e.type === "shot") {
      const origin: Pt = { x: e.x ?? goalX, y: e.y ?? 50 }, build = attack(e.type === "goal" ? 4 : 2, origin), mouth = 44 + r() * 12, end = e.type === "goal" ? { x: goalX, y: mouth } : e.type === "shot_on_target" ? { x: side === "home" ? 97 : 3, y: mouth } : { x: goalX, y: r() < 0.5 ? 30 + r() * 10 : 60 + r() * 10 };
      out.push({ type: "beat", beat: { seq: e.seq, t: e.t, kind: e.type, team: side, path: [...build, end], durationMs: DURATION[e.type], banner: e.type === "goal" ? "GOAL" : null, detail: e.type === "goal" ? `${e.score.home} – ${e.score.away}` : e.type === "shot_on_target" ? "Saved" : "Off target" } }); last = { t: e.t, ball: e.type === "goal" ? { x: 50, y: 50 } : e.type === "shot_on_target" ? end : { x: side === "home" ? 90 : 10, y: 50 } };
    } else if (e.type === "corner") { const flag: Pt = { x: e.x ?? goalX, y: e.y ?? 0 }, box: Pt = { x: side === "home" ? 88 : 12, y: 42 + r() * 16 }; out.push({ type: "beat", beat: { seq: e.seq, t: e.t, kind: "corner", team: side, path: [flag, box], durationMs: DURATION.corner, banner: null, detail: "Corner" } }); last = { t: e.t, ball: box };
    } else if (e.type === "yellow" || e.type === "red") { out.push({ type: "beat", beat: { seq: e.seq, t: e.t, kind: e.type, team: side, path: [last.ball], durationMs: DURATION[e.type], banner: e.type === "red" ? "RED CARD" : "YELLOW CARD", detail: null } });
    } else if (e.type === "substitution") { const f = side === "home" ? home : away; let slot = 1 + Math.floor(r() * (fh - 1)); for (let g = 0; g < 12 && used[side].has(slot); g++) slot = 1 + ((slot + 1) % (fh - 1)); used[side].add(slot); const onNumber = 12 + subs[side]++;
      out.push({ type: "beat", beat: { seq: e.seq, t: e.t, kind: "substitution", team: side, path: [last.ball], durationMs: DURATION.substitution, banner: "SUBSTITUTION", detail: `OFF #${shirtNumber(slot)} ${f.slots[slot].role}  ·  ON #${onNumber}`, sub: { slot, offRole: f.slots[slot].role, offNumber: shirtNumber(slot), onNumber } } }); }
  }
  spell(last.t, 90 + sim.addedTime, makeRng(`${sim.seed}:vis:end`)); return out;
}
export const isBeatEvent = (e: SimEvent) => !!e.team && e.type !== "half_time" && e.type !== "full_time";
/** Position of a point along a polyline, 0 to 1. */
export function along(path: Pt[], k: number): Pt { if (path.length === 1) return path[0]; const seg = clamp(k, 0, 1) * (path.length - 1), i = Math.min(path.length - 2, Math.floor(seg)), f = seg - i; return { x: path[i].x + (path[i + 1].x - path[i].x) * f, y: path[i].y + (path[i + 1].y - path[i].y) * f }; }
export const sideOf = (i: number, n = 11) => (i < n ? "home" : "away");
