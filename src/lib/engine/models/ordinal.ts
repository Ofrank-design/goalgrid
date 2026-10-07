import type { FittedModel, HistMatch, Model, ModelFamily, Probs } from "../../../types/prediction";
import { normalize, outcomeIdx } from "./math";
const sig = (x: number) => 1 / (1 + Math.exp(-x));
export type Ord = (d: number) => Probs;
/** Ordered logit: a rating gap becomes home, draw and away probabilities with a fitted scale, home shift and draw width. */
export function fitOrdered(rows: { d: number; y: 0 | 1 | 2 }[]): Ord | null {
  if (rows.length < 60) return null;
  const nll = (a: number, h: number, c: number) => { let s = 0; for (const r of rows) { const z = a * r.d + h, ph = sig(z - c), pa = sig(-z - c); s -= Math.log(Math.max([ph, Math.max(1 - ph - pa, 1e-6), pa][r.y], 1e-9)); } return s; };
  let a = 1, h = 0.3, c = 0.5, step = 0.5, best = nll(a, h, c);
  for (let it = 0; it < 80 && step > 0.005; it++) {
    let moved = false;
    for (const [da, dh, dc] of [[step, 0, 0], [-step, 0, 0], [0, step, 0], [0, -step, 0], [0, 0, step], [0, 0, -step]]) { const v = nll(a + da, h + dh, Math.max(c + dc, 0.05)); if (v < best) { best = v; a += da; h += dh; c = Math.max(c + dc, 0.05); moved = true; } }
    if (!moved) step /= 2;
  }
  return d => { const z = a * d + h, ph = sig(z - c), pa = sig(-z - c); return normalize({ home: ph, draw: Math.max(1 - ph - pa, 0.02), away: pa }); };
}
type Rater = (h: string, a: string) => number | null;
/** Ratings fitted on matches before each chunk give honest training gaps, so the mapping is not overconfident. */
export function walkForward(hist: HistMatch[], build: (train: HistMatch[]) => Rater | null, chunks = 8) {
  const s = [...hist].sort((a, b) => a.date.localeCompare(b.date)), n = s.length, rows: { d: number; y: 0 | 1 | 2 }[] = [];
  for (let i = 1; i <= chunks; i++) { const from = Math.floor(n * i / (chunks + 1)), to = Math.floor(n * (i + 1) / (chunks + 1)), f = build(s.slice(0, from)); if (!f) continue; for (const m of s.slice(from, to)) { const d = f(m.home, m.away); if (d != null) rows.push({ d, y: outcomeIdx(m.hg, m.ag) }); } }
  return rows;
}
export function ratingModel(id: string, name: string, family: ModelFamily, build: (train: HistMatch[]) => Rater | null): Model {
  return { id, name, family, fit: (hist): FittedModel | null => { const all = build(hist), ord = fitOrdered(walkForward(hist, build)); if (!all || !ord) return null; return { predict: (h, a) => { const d = all(h, a); return d == null ? null : ord(d); } }; } };
}
/** For online ratings (Glicko-2, TrueSkill): record the gap before each match, then update. */
export function onlineModel<S>(id: string, name: string, init: () => S, gap: (s: S, h: string, a: string) => number | null, update: (s: S, m: HistMatch) => void): Model {
  return { id, name, family: "rating", fit: hist => {
    const s = init(), rows: { d: number; y: 0 | 1 | 2 }[] = [];
    for (const m of [...hist].sort((a, b) => a.date.localeCompare(b.date))) { const d = gap(s, m.home, m.away); if (d != null) rows.push({ d, y: outcomeIdx(m.hg, m.ag) }); update(s, m); }
    const ord = fitOrdered(rows.slice(Math.floor(rows.length * 0.15))); if (!ord) return null;
    return { predict: (h, a) => { const d = gap(s, h, a); return d == null ? null : ord(d); } };
  } };
}
