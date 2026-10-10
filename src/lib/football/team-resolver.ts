import { teamSlug } from "../engine/normalization/teams";

/**
 * Providers name the same club differently ("Manchester United FC", "Man United", "Manchester Utd") and number it differently
 * (football-data 66, API-Football 33). Within one competition, two names are the same team when they normalise to the same
 * words, when each word of the shorter name is the start of a distinct word of the longer one, or when they are very close
 * as strings. Pure functions, no provider calls.
 */
/** Common abbreviations providers use, spelled out so "Manchester Utd" and "Manchester United" compare as equal. */
const ABBREVIATIONS: Record<string, string> = { utd: "united", ath: "athletic", dep: "deportivo", intl: "international" };
/** Well-known nicknames that share no word start with the full name. */
const NICKNAMES: Record<string, string> = { wolves: "wolverhampton-wanderers", spurs: "tottenham-hotspur", gladbach: "borussia-monchengladbach", psg: "paris-saint-germain", "man-utd": "manchester-united" };
const words = (name: string) => { const slug = teamSlug(name); return (NICKNAMES[slug] ?? slug).split("-").filter(Boolean).map((w) => ABBREVIATIONS[w] ?? w); };

/** Jaro-Winkler similarity, 0 to 1. */
export function jaroWinkler(a: string, b: string): number {
  if (a === b) return 1;
  if (!a.length || !b.length) return 0;
  const range = Math.max(0, Math.floor(Math.max(a.length, b.length) / 2) - 1), am = new Array<boolean>(a.length).fill(false), bm = new Array<boolean>(b.length).fill(false);
  let matches = 0;
  for (let i = 0; i < a.length; i++) for (let j = Math.max(0, i - range); j < Math.min(b.length, i + range + 1); j++) if (!bm[j] && a[i] === b[j]) { am[i] = bm[j] = true; matches++; break; }
  if (!matches) return 0;
  let t = 0, k = 0;
  for (let i = 0; i < a.length; i++) if (am[i]) { while (!bm[k]) k++; if (a[i] !== b[k]) t++; k++; }
  const jaro = (matches / a.length + matches / b.length + (matches - t / 2) / matches) / 3;
  let prefix = 0; while (prefix < Math.min(4, a.length, b.length) && a[prefix] === b[prefix]) prefix++;
  return jaro + prefix * 0.1 * (1 - jaro);
}

/** Every word of one name starts a different word of the other: "man united" matches "manchester united", in either direction. */
function startsWords(s: string[], l: string[]): boolean {
  if (!s.length || s.join("").length < 4) return false;
  const used = new Set<number>();
  return s.every((w) => { const i = l.findIndex((v, idx) => !used.has(idx) && v.startsWith(w)); if (i < 0) return false; used.add(i); return true; });
}
const prefixWords = (x: string[], y: string[]) => (x.length === y.length ? startsWords(x, y) || startsWords(y, x) : x.length < y.length ? startsWords(x, y) : startsWords(y, x));

export function teamSimilarity(a: string, b: string): number {
  const x = words(a), y = words(b);
  if (!x.length || !y.length) return 0;
  if (x.join(" ") === y.join(" ")) return 1;
  if (prefixWords(x, y)) return 0.95;
  return jaroWinkler(x.join(" "), y.join(" "));
}

/** Slugs and names are both accepted. */
export const sameTeam = (a: string, b: string, threshold = 0.93): boolean => a === b || teamSimilarity(a.replace(/-/g, " "), b.replace(/-/g, " ")) >= threshold;

/** The best candidate for a name, or null when none is close enough. */
export function resolveTeam<T extends { name: string }>(name: string, candidates: readonly T[], threshold = 0.93): T | null {
  let best: T | null = null, top = 0;
  for (const c of candidates) { const s = teamSimilarity(name, c.name); if (s > top) { top = s; best = c; } }
  return top >= threshold ? best : null;
}
