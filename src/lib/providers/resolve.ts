/** Pure helpers shared by the newer provider adapters. No network, no secrets, so they are easy to test. */

const flat = (s: string) => s.toLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "");

/**
 * Picks the row whose name is the wanted competition. Spacing and punctuation are ignored ("La Liga" is "LaLiga").
 * An exact match wins; failing that, the shortest name that starts with the wanted one ("Serie A Enilive"). A longer name that only
 * shares a prefix never beats an exact one, so "Premier League 2" is not chosen over "Premier League".
 */
export function pickByName<T>(rows: readonly T[], nameOf: (row: T) => string | null | undefined, wanted: string): T | undefined {
  const w = flat(wanted); if (!w) return undefined;
  const named = rows.flatMap((row) => { const n = nameOf(row); return typeof n === "string" && n ? [{ row, f: flat(n) }] : []; });
  return named.find((x) => x.f === w)?.row ?? named.filter((x) => x.f.startsWith(w)).sort((a, b) => a.f.length - b.f.length)[0]?.row;
}

/** A finite number from a number or a string such as "54", "54%" or "1.45". Anything else is null, never 0. */
export function num(v: unknown): number | null {
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  if (typeof v !== "string") return null;
  const n = Number.parseFloat(v.replace(/[%\s]/g, "").replace(",", ".")); return Number.isFinite(n) ? n : null;
}

/** "2026-10-09" plus n days, in UTC. */
export const addDays = (date: string, n: number): string => new Date(Date.parse(`${date}T00:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10);

/** The feature rule: anything observed after the prediction time can never be used to price the match. */
export const observedBefore = (observedAt: string, predictionTime: string | Date): boolean => {
  const o = Date.parse(observedAt), p = typeof predictionTime === "string" ? Date.parse(predictionTime) : predictionTime.getTime();
  return Number.isFinite(o) && Number.isFinite(p) && o <= p;
};

/** Reads one envelope level the providers share: `{ data: ... }`. Returns undefined rather than throwing on any other shape. */
export const dataOf = (json: unknown): unknown => (json && typeof json === "object" ? (json as { data?: unknown }).data : undefined);
