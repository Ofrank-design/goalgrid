/** Seeded random numbers. The same seed always gives the same sequence, so any run can be reproduced exactly. */
export const ENGINE_VERSION = "sim-1.1.0", MODEL_VERSION = "ensemble-weighted-matrix-v1";
export function hashSeed(s: string): number { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
export function makeRng(seed: string): () => number {
  let a = hashSeed(seed);
  return () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
export const validSeed = (s: unknown): s is string => typeof s === "string" && /^[A-Za-z0-9]{1,16}$/.test(s);
export function poissonSample(r: () => number, lambda: number): number { if (lambda <= 0) return 0; const L = Math.exp(-Math.min(lambda, 30)); let k = 0, p = 1; do { k++; p *= r(); } while (p > L && k < 60); return k - 1; }
/** Draws a score from a joint score matrix. */
export function sampleScore(M: number[][], u: number): [number, number] {
  let acc = 0, last: [number, number] = [0, 0]; for (let x = 0; x < M.length; x++) for (let y = 0; y < M[x].length; y++) { acc += M[x][y]; last = [x, y]; if (u < acc) return [x, y]; } return last;
}
