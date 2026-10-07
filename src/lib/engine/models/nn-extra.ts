import type { FittedModel, Model } from "../../../types/prediction";
import { buildFeatures, featureExt, seqFor, type Row } from "./features";
import { hashStr, randn, rng, softmax } from "./math";
const MIN_ROWS = 150;
const dotv = (w: number[], o: number, x: number[]) => { let s = 0; for (let i = 0; i < x.length; i++) s += w[o + i] * x[i]; return s; };
const relu = (x: number) => (x > 0 ? x : 0), sg = (x: number) => 1 / (1 + Math.exp(-x));
const stdz = (rows: Row[]) => { const F = rows[0].xe.length, m = new Array(F).fill(0), s = new Array(F).fill(0); rows.forEach(r => r.xe.forEach((v, j) => (m[j] += v / rows.length))); rows.forEach(r => r.xe.forEach((v, j) => (s[j] += (v - m[j]) ** 2 / rows.length))); const sd = s.map(v => Math.sqrt(v) || 1); return (x: number[]) => x.map((v, j) => (v - m[j]) / sd[j]); };
/** 40. Feedforward network: one hidden layer, trained with full batch gradient descent and momentum. */
export const feedforward: Model = { id: "feedforward-nn", name: "Feedforward Neural Network", family: "deep-learning", about: "One hidden layer of 8 units, trained by backpropagation.", heavy: true, fit: (hist): FittedModel | null => {
  const { rows, state } = buildFeatures(hist); if (rows.length < MIN_ROWS) return null; const z = stdz(rows), X = rows.map(r => [...z(r.xe), 1]), F = X[0].length, H = 8, r0 = rng(11);
  const W1 = Array.from({ length: H }, () => Array.from({ length: F }, () => randn(r0) * 0.3)), W2 = Array.from({ length: 3 }, () => Array.from({ length: H + 1 }, () => randn(r0) * 0.3));
  const v1 = W1.map(r => r.map(() => 0)), v2 = W2.map(r => r.map(() => 0)), fwd = (x: number[]) => { const h = W1.map(w => Math.tanh(dotv(w, 0, x))); const p = softmax(W2.map(w => dotv(w, 0, [...h, 1]))); return { h, p }; };
  for (let ep = 0; ep < 250; ep++) {
    const g1 = W1.map(r => r.map(() => 0)), g2 = W2.map(r => r.map(() => 0));
    rows.forEach((r, i) => { const { h, p } = fwd(X[i]), dz = p.map((v, k) => v - (r.y === k ? 1 : 0)), dh = h.map((hv, j) => (1 - hv * hv) * dz.reduce((s, d, k) => s + d * W2[k][j], 0));
      for (let k = 0; k < 3; k++) { for (let j = 0; j < H; j++) g2[k][j] += dz[k] * h[j]; g2[k][H] += dz[k]; } for (let j = 0; j < H; j++) for (let q = 0; q < F; q++) g1[j][q] += dh[j] * X[i][q]; });
    const n = rows.length; for (let k = 0; k < 3; k++) for (let j = 0; j <= H; j++) { v2[k][j] = 0.9 * v2[k][j] - 0.05 * (g2[k][j] / n + 0.003 * W2[k][j]); W2[k][j] += v2[k][j]; } for (let j = 0; j < H; j++) for (let q = 0; q < F; q++) { v1[j][q] = 0.9 * v1[j][q] - 0.05 * (g1[j][q] / n + 0.003 * W1[j][q]); W1[j][q] += v1[j][q]; }
  }
  return { predict: (h, a, ctx) => { const e = featureExt(state, h, a, ctx?.kickoffUtc ? Date.parse(ctx.kickoffUtc) : null); if (!e) return null; const p = fwd([...z(e.xe), 1]).p; return { home: p[0], draw: p[1], away: p[2] }; } };
} };
/** Gradient free training (SPSA): two forward passes per step whatever the parameter count. Keeps this build dependency free. Replace with a deep learning framework in an offline job for production. */
function spsa(p0: number[], loss: (p: number[], idx: number[]) => number, n: number, iters: number, seed: number, batch = 160) {
  const p = [...p0], r = rng(seed), a = 0.25, c = 0.1, A = iters / 10;
  for (let k = 0; k < iters; k++) { const ak = a / Math.pow(k + 1 + A, 0.602), ck = c / Math.pow(k + 1, 0.101), idx = Array.from({ length: Math.min(batch, n) }, () => Math.floor(r() * n)), d = p.map(() => (r() < 0.5 ? -1 : 1));
    const g = (loss(p.map((v, i) => v + ck * d[i]), idx) - loss(p.map((v, i) => v - ck * d[i]), idx)) / (2 * ck); for (let i = 0; i < p.length; i++) p[i] -= Math.max(-0.15, Math.min(0.15, ak * g * d[i])); }
  return p;
}
interface Net { size: number; logits(p: number[], r: Pick<Row, "xe" | "seq">): number[] }
function netModel(id: string, name: string, about: string, net: Net, iters = 450): Model {
  return { id, name, family: "deep-learning", about: `${about} Trained gradient free (SPSA).`, heavy: true, fit: (hist): FittedModel | null => {
    const { rows, state } = buildFeatures(hist); if (rows.length < MIN_ROWS) return null; const z = stdz(rows), R = rows.map(r => ({ ...r, xe: z(r.xe) })), r0 = rng(hashStr(id)), p0 = Array.from({ length: net.size }, () => randn(r0) * 0.15);
    const loss = (p: number[], idx: number[]) => { let l = 0; for (const i of idx) l -= Math.log(Math.max(softmax(net.logits(p, R[i]))[R[i].y], 1e-9)); return l / idx.length + 1e-3 * p.reduce((s, v) => s + v * v, 0) / p.length; };
    const P = spsa(p0, loss, R.length, iters, hashStr(name));
    return { predict: (h, a, ctx) => { const e = featureExt(state, h, a, ctx?.kickoffUtc ? Date.parse(ctx.kickoffUtc) : null); if (!e) return null; const p = softmax(net.logits(P, { xe: z(e.xe), seq: [seqFor(state, h), seqFor(state, a)] })); return p.every(Number.isFinite) ? { home: p[0], draw: p[1], away: p[2] } : null; } };
  } };
}
/** 41. TabNet style: two decision steps, each with a learned soft feature mask, so the net chooses which inputs to look at. */
const TF = 6, TH = 8, T_A1 = 0, T_B1 = T_A1 + TF * TF, T_W1 = T_B1 + TF, T_C1 = T_W1 + TH * TF, T_A2 = T_C1 + TH, T_B2 = T_A2 + TF * TH, T_W2 = T_B2 + TF, T_C2 = T_W2 + TH * TF, T_U = T_C2 + TH;
export const tabNet = netModel("tabnet-style", "TabNet", "Two decision steps with learned soft feature masks, in the style of TabNet.", { size: T_U + 3 * (TH + 1), logits: (p, r) => {
  const x = r.xe, m1 = softmax(Array.from({ length: TF }, (_, i) => dotv(p, T_A1 + i * TF, x) + p[T_B1 + i])).map(v => v * TF), x1 = x.map((v, i) => v * m1[i]);
  const h1 = Array.from({ length: TH }, (_, j) => relu(dotv(p, T_W1 + j * TF, x1) + p[T_C1 + j])), m2 = softmax(Array.from({ length: TF }, (_, i) => dotv(p, T_A2 + i * TH, h1) + p[T_B2 + i])).map(v => v * TF), x2 = x.map((v, i) => v * m2[i] * Math.max(0, 1 - m1[i] / TF));
  const h2 = Array.from({ length: TH }, (_, j) => relu(dotv(p, T_W2 + j * TF, x2) + p[T_C2 + j])), o = [...h1.map((v, j) => v + h2[j]), 1]; return [0, 1, 2].map(k => dotv(p, T_U + k * (TH + 1), o)); } });
/** Siamese sequence encoders: the same weights read the home and the away team's last six matches. */
const D = 4, SQ = 6, head = (hv: number[], av: number[], x: number[]) => [...hv, ...av, x[0], 1];
/** 42. Temporal convolutional network: two causal dilated convolutions over the last six matches. */
const C = 6, W1S = C * 2 * D, B1 = W1S, W2S = B1 + C, B2 = W2S + C * 2 * C, TU = B2 + C;
const tcnEnc = (p: number[], seq: number[][]) => { const y1 = seq.map((_, t) => Array.from({ length: C }, (_, c) => { let s = p[B1 + c]; for (let k = 0; k < 2; k++) { const u = t - k; if (u >= 0) for (let d = 0; d < D; d++) s += p[(c * 2 + k) * D + d] * seq[u][d]; } return relu(s); }));
  const t = SQ - 1; return Array.from({ length: C }, (_, c) => { let s = p[B2 + c]; for (let k = 0; k < 2; k++) { const u = t - 2 * k; if (u >= 0) for (let q = 0; q < C; q++) s += p[W2S + (c * 2 + k) * C + q] * y1[u][q]; } return relu(s); }); };
export const tcn = netModel("tcn", "Temporal Convolutional Network", "Two causal dilated convolutions over each team's last six matches.", { size: TU + 3 * (2 * C + 2), logits: (p, r) => { const o = head(tcnEnc(p, r.seq[0]), tcnEnc(p, r.seq[1]), r.xe); return [0, 1, 2].map(k => dotv(p, TU + k * (2 * C + 2), o)); } });
/** 43. LSTM over each team's recent form sequence. */
const H = 6, GS = H * D + H * H + H, LU = 4 * GS;
const lstmEnc = (p: number[], seq: number[][]) => { let h = new Array(H).fill(0), c = new Array(H).fill(0);
  for (const x of seq) { const z = (g: number, j: number) => { const b = g * GS; let s = p[b + H * D + H * H + j]; for (let d = 0; d < D; d++) s += p[b + j * D + d] * x[d]; for (let q = 0; q < H; q++) s += p[b + H * D + j * H + q] * h[q]; return s; };
    const nc: number[] = [], nh: number[] = []; for (let j = 0; j < H; j++) { const i = sg(z(0, j)), f = sg(z(1, j) + 1), g = Math.tanh(z(2, j)), o = sg(z(3, j)); nc.push(f * c[j] + i * g); nh.push(o * Math.tanh(nc[j])); } c = nc; h = nh; } return h; };
export const lstm = netModel("lstm-form", "LSTM Form Sequence Model", "A single layer LSTM over each team's last six matches.", { size: LU + 3 * (2 * H + 2), logits: (p, r) => { const o = head(lstmEnc(p, r.seq[0]), lstmEnc(p, r.seq[1]), r.xe); return [0, 1, 2].map(k => dotv(p, LU + k * (2 * H + 2), o)); } });
/** 44. Transformer encoder: positional embeddings and one self attention head over the last six matches. */
const d = 6, WIN = 0, BIN = d * D, POS = BIN + d, WQ = POS + SQ * d, WK = WQ + d * d, WV = WK + d * d, XU = WV + d * d;
const trfEnc = (p: number[], seq: number[][]) => { const x = seq.map((s, t) => Array.from({ length: d }, (_, j) => dotv(p, WIN + j * D, s) + p[BIN + j] + p[POS + t * d + j])), lin = (o: number, v: number[]) => Array.from({ length: d }, (_, j) => dotv(p, o + j * d, v));
  const Q = x.map(v => lin(WQ, v)), K = x.map(v => lin(WK, v)), V = x.map(v => lin(WV, v)), pooled = new Array(d).fill(0);
  for (let t = 0; t < SQ; t++) { const a = softmax(K.map(k => k.reduce((s, kv, j) => s + kv * Q[t][j], 0) / Math.sqrt(d))); for (let j = 0; j < d; j++) pooled[j] += (a.reduce((s, av, u) => s + av * V[u][j], 0) + x[t][j]) / SQ; } return pooled; };
export const transformer = netModel("transformer-form", "Transformer Form Sequence Model", "One self attention head with positional embeddings over the last six matches.", { size: XU + 3 * (2 * d + 2), logits: (p, r) => { const o = head(trfEnc(p, r.seq[0]), trfEnc(p, r.seq[1]), r.xe); return [0, 1, 2].map(k => dotv(p, XU + k * (2 * d + 2), o)); } });
