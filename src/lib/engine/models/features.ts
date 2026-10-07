import type { HistMatch } from "../../../types/prediction";
import { outcomeIdx } from "./math";
export const HA = 65, K = 20, LAST = 5, SEQ = 6, DAY = 86_400_000;
export interface State { elo: Map<string, number>; pts: Map<string, number[]>; gd: Map<string, number[]>; n: Map<string, number>; drawRate: number;
  hpts: Map<string, number[]>; apts: Map<string, number[]>; tot: Map<string, number[]>; times: Map<string, number[]>; seq: Map<string, number[][]> }
export const expected = (rh: number, ra: number) => 1 / (1 + Math.pow(10, -(rh + HA - ra) / 400));
const mean = (xs: number[] | undefined, d: number) => (xs && xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : d);
const clip = (x: number, a: number, b: number) => Math.min(Math.max(x, a), b);
export function featureVec(s: State, h: string, a: string): number[] | null {
  if (!s.n.get(h) || !s.n.get(a)) return null;
  return [((s.elo.get(h) ?? 1500) + HA - (s.elo.get(a) ?? 1500)) / 400, (mean(s.pts.get(h), 1) - mean(s.pts.get(a), 1)) / 3, (mean(s.gd.get(h), 0) - mean(s.gd.get(a), 0)) / 2];
}
/** Extended features. Rest and congestion need the kickoff time; without it they are zero. Also returns the rest and congestion gap for the rest model. */
export function featureExt(s: State, h: string, a: string, kickMs: number | null): { xe: number[]; rc: [number, number] } | null {
  const base = featureVec(s, h, a); if (!base) return null;
  const rest = (t: string) => { const ts = s.times.get(t); return kickMs != null && ts?.length ? clip((kickMs - ts[ts.length - 1]) / DAY, 2, 14) : 7; };
  const cong = (t: string) => kickMs != null ? (s.times.get(t) ?? []).filter(x => kickMs - x <= 14 * DAY && kickMs - x > 0).length : 0;
  const restD = (rest(h) - rest(a)) / 7, congD = (cong(h) - cong(a)) / 3;
  return { xe: [...base, clip(restD, -1, 1), (mean(s.hpts.get(h), 1.4) - mean(s.apts.get(a), 1.1)) / 3, (((mean(s.tot.get(h), 2.7) + mean(s.tot.get(a), 2.7)) / 2) - 2.7) / 1.5], rc: [restD, congD] };
}
export const seqFor = (s: State, t: string): number[][] => { const q = s.seq.get(t) ?? []; return [...Array.from({ length: SEQ - q.length }, () => [0, 0, 0, 0]), ...q]; };
const push = (m: Map<string, number[]>, k: string, v: number, cap = LAST) => { const a = m.get(k) ?? []; a.push(v); if (a.length > cap) a.shift(); m.set(k, a); };
const pushSeq = (m: Map<string, number[][]>, k: string, v: number[]) => { const a = m.get(k) ?? []; a.push(v); if (a.length > SEQ) a.shift(); m.set(k, a); };
export interface Row { x: number[]; xe: number[]; rc: [number, number]; y: 0 | 1 | 2; gd: number; date: string; seq: [number[][], number[][]] }
export function newState(hist: HistMatch[]): State {
  return { elo: new Map(), pts: new Map(), gd: new Map(), n: new Map(), drawRate: hist.filter(m => m.hg === m.ag).length / Math.max(hist.length, 1), hpts: new Map(), apts: new Map(), tot: new Map(), times: new Map(), seq: new Map() };
}
/** Walks matches in date order. Each row's features use only information available before that match. */
export function buildFeatures(hist: HistMatch[]): { rows: Row[]; state: State } {
  const sorted = [...hist].sort((a, b) => a.date.localeCompare(b.date)), s = newState(sorted), rows: Row[] = [];
  for (const m of sorted) {
    const kick = Date.parse(m.date), fe = featureExt(s, m.home, m.away, kick);
    if (fe && (s.n.get(m.home) ?? 0) >= 3 && (s.n.get(m.away) ?? 0) >= 3) rows.push({ x: fe.xe.slice(0, 3), xe: fe.xe, rc: fe.rc, y: outcomeIdx(m.hg, m.ag), gd: m.hg - m.ag, date: m.date, seq: [seqFor(s, m.home), seqFor(s, m.away)] });
    const rh = s.elo.get(m.home) ?? 1500, ra = s.elo.get(m.away) ?? 1500, d = Math.abs(m.hg - m.ag), G = d <= 1 ? 1 : d === 2 ? 1.5 : (11 + d) / 8;
    const S = m.hg > m.ag ? 1 : m.hg === m.ag ? 0.5 : 0, delta = K * G * (S - expected(rh, ra));
    s.elo.set(m.home, rh + delta); s.elo.set(m.away, ra - delta);
    const ph = S === 1 ? 3 : S === 0.5 ? 1 : 0, pa = S === 0 ? 3 : S === 0.5 ? 1 : 0;
    push(s.pts, m.home, ph); push(s.pts, m.away, pa); push(s.gd, m.home, m.hg - m.ag); push(s.gd, m.away, m.ag - m.hg);
    push(s.hpts, m.home, ph); push(s.apts, m.away, pa); push(s.tot, m.home, m.hg + m.ag); push(s.tot, m.away, m.hg + m.ag); push(s.times, m.home, kick, 12); push(s.times, m.away, kick, 12);
    pushSeq(s.seq, m.home, [m.hg / 3, m.ag / 3, 1, S]); pushSeq(s.seq, m.away, [m.ag / 3, m.hg / 3, 0, 1 - S]);
    s.n.set(m.home, (s.n.get(m.home) ?? 0) + 1); s.n.set(m.away, (s.n.get(m.away) ?? 0) + 1);
  }
  return { rows, state: s };
}
