import type { HistMatch, Model } from "@/types/prediction";
import { ALL_MODELS } from "../models/ensemble";
import { outcomeIdx } from "../models/math";
import { GOALGRID_LIMITS } from "../../control/limits";
/** Rolling walk-forward backtest: train on everything before a cut, test on the next block, move the cut forward, repeat. Never mixes future into past. Slow by design (every model is refitted per fold), so it runs from a script or a job, not in a request. */
export interface BacktestRow { id: string; name: string; family: string; folds: number; matches: number; logLoss: number | null; brier1x2: number | null; bttsBrier: number | null; over25Brier: number | null; ece: number | null; coverage: number; failureRate: number; msPerFit: number }
export interface BacktestResult { folds: { trainMatches: number; testMatches: number; testFrom: string; testTo: string }[]; baseline: { logLoss: number; bttsBrier: number; over25Brier: number }; models: BacktestRow[] }
const safe = <T,>(f: () => T): T | null => { try { return f(); } catch { return null; } };
export function walkForwardBacktest(history: HistMatch[], o: { folds?: number; startFraction?: number; models?: Model[] } = {}): BacktestResult {
  const h = [...history].sort((a, b) => a.date.localeCompare(b.date)), folds = o.folds ?? 4, start = Math.floor(h.length * (o.startFraction ?? 0.5)), size = Math.floor((h.length - start) / folds), requested = o.models ?? ALL_MODELS, models = requested.filter(m => m.family !== "market").slice(0, GOALGRID_LIMITS.model.candidateMaxModels);
  const acc = new Map<string, { n: number; ll: number; br: number; bb: number; bn: number; ob: number; on: number; asked: number; failed: number; ms: number; fits: number; bins: { p: number; hit: number; n: number }[]; folds: number }>();
  const foldInfo: BacktestResult["folds"] = []; let bl = 0, bbb = 0, bob = 0, bn = 0;
  for (let k = 0; k < folds; k++) {
    const from = start + k * size, to = k === folds - 1 ? h.length : from + size, train = h.slice(0, from), test = h.slice(from, to); if (test.length < 20 || train.length < 100) continue;
    foldInfo.push({ trainMatches: train.length, testMatches: test.length, testFrom: test[0].date, testTo: test[test.length - 1].date });
    const rate = [0, 1, 2].map(i => (train.filter(t => outcomeIdx(t.hg, t.ag) === i).length + 1) / (train.length + 3)), pb = train.filter(t => t.hg > 0 && t.ag > 0).length / train.length, po = train.filter(t => t.hg + t.ag > 2).length / train.length;
    for (const t of test) { bl -= Math.log(rate[outcomeIdx(t.hg, t.ag)]); bbb += (pb - +(t.hg > 0 && t.ag > 0)) ** 2; bob += (po - +(t.hg + t.ag > 2)) ** 2; bn++; }
    for (const m of models) {
      const a = acc.get(m.id) ?? { n: 0, ll: 0, br: 0, bb: 0, bn: 0, ob: 0, on: 0, asked: 0, failed: 0, ms: 0, fits: 0, bins: Array.from({ length: 10 }, () => ({ p: 0, hit: 0, n: 0 })), folds: 0 }; acc.set(m.id, a);
      const t0 = Date.now(), f = safe(() => m.fit(train, new Date(test[0].date))); a.ms += Date.now() - t0; a.fits++; if (!f) { a.asked += test.length; a.failed += test.length; continue; } a.folds++;
      for (const t of test) {
        a.asked++; const p = safe(() => f.predict(t.home, t.away, { kickoffUtc: t.date })); if (!p || ![p.home, p.draw, p.away].every(Number.isFinite)) { a.failed++; continue; }
        const v = [p.home, p.draw, p.away], y = outcomeIdx(t.hg, t.ag); a.n++; a.ll -= Math.log(Math.max(v[y], 1e-6)); a.br += v.reduce((s, x, i) => s + (x - +(i === y)) ** 2, 0);
        const b = a.bins[Math.min(9, Math.floor(p.home * 10))]; b.p += p.home; b.hit += +(y === 0); b.n++;
        if (p.matrix) { let bt = 0, ov = 0; p.matrix.forEach((r, x) => r.forEach((q, yy) => { if (x > 0 && yy > 0) bt += q; if (x + yy > 2) ov += q; })); a.bb += (bt - +(t.hg > 0 && t.ag > 0)) ** 2; a.bn++; a.ob += (ov - +(t.hg + t.ag > 2)) ** 2; a.on++; }
      }
    }
  }
  const r4 = (x: number) => Math.round(x * 10000) / 10000;
  return { folds: foldInfo, baseline: { logLoss: r4(bl / Math.max(bn, 1)), bttsBrier: r4(bbb / Math.max(bn, 1)), over25Brier: r4(bob / Math.max(bn, 1)) },
    models: models.map(m => { const a = acc.get(m.id); if (!a) return { id: m.id, name: m.name, family: m.family, folds: 0, matches: 0, logLoss: null, brier1x2: null, bttsBrier: null, over25Brier: null, ece: null, coverage: 0, failureRate: 1, msPerFit: 0 };
      const tot = a.bins.reduce((s, b) => s + b.n, 0), ece = tot ? a.bins.reduce((s, b) => s + (b.n ? Math.abs(b.p / b.n - b.hit / b.n) * b.n : 0), 0) / tot : null;
      return { id: m.id, name: m.name, family: m.family, folds: a.folds, matches: a.n, logLoss: a.n ? r4(a.ll / a.n) : null, brier1x2: a.n ? r4(a.br / a.n) : null, bttsBrier: a.bn ? r4(a.bb / a.bn) : null, over25Brier: a.on ? r4(a.ob / a.on) : null, ece: ece == null ? null : r4(ece), coverage: a.asked ? r4(a.n / a.asked) : 0, failureRate: a.asked ? r4(a.failed / a.asked) : 1, msPerFit: a.fits ? Math.round(a.ms / a.fits) : 0 }; }) };
}
