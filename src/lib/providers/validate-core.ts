import type { ZodType } from "zod";

/** Pure part of response validation: keeps items that fit the schema and reports whether too many failed (a likely format change). */
export function checkItems<T>(raw: unknown[], schema: ZodType<T>, minValidShare = 0.5): { ok: T[]; dropped: number; firstIssue: string; tripped: boolean } {
  const ok: T[] = []; let dropped = 0, firstIssue = "";
  for (const item of raw) {
    const r = schema.safeParse(item);
    if (r.success) ok.push(r.data); else { dropped++; firstIssue ||= `${r.error.issues[0]?.path.join(".") || "(item)"}: ${r.error.issues[0]?.message}`; }
  }
  // Tiny lists are too small to judge a format change from, so they never trip.
  return { ok, dropped, firstIssue, tripped: raw.length >= 4 && ok.length / raw.length < minValidShare };
}
