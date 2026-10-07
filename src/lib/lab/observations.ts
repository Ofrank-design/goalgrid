import { z } from "zod";
/** The one internal shape every source is turned into. Provider response shapes stop here and never reach the UI. */
export interface GameObservation { gameId: string; sourceId: string; externalRoundId: string | null; observedAt: string; value: number; rawValue: string | null; sequence: number | null; dataQuality: "verified" | "observed" | "partial" }
const row = z.object({ externalRoundId: z.union([z.string().max(80), z.number()]).optional().nullable(), observedAt: z.string().refine(s => !Number.isNaN(Date.parse(s)), "bad date"), value: z.union([z.number(), z.string()]), sequence: z.number().int().optional().nullable() });
export interface ImportReport { accepted: GameObservation[]; rejected: { index: number; reason: string }[]; duplicatesInBatch: number }
/** Validates, normalises and deduplicates a batch. Nothing is guessed: a bad row is rejected and reported, never repaired. Observations are append only downstream. */
export function normalizeBatch(rows: unknown[], ctx: { gameId: string; sourceId: string; quality?: GameObservation["dataQuality"]; now?: number }): ImportReport {
  const out: GameObservation[] = [], rejected: ImportReport["rejected"] = [], seen = new Set<string>(); let dup = 0; const now = ctx.now ?? Date.now();
  rows.forEach((r, index) => {
    const p = row.safeParse(r); if (!p.success) { rejected.push({ index, reason: "Row does not match the expected shape" }); return; }
    const raw = String(p.data.value).trim(), value = typeof p.data.value === "number" ? p.data.value : Number(raw.replace(/x$/i, ""));
    if (!Number.isFinite(value) || value < 0 || value > 1e7) { rejected.push({ index, reason: "Value is not a finite non-negative number" }); return; }
    if (Date.parse(p.data.observedAt) > now + 60_000) { rejected.push({ index, reason: "Observation time is in the future" }); return; }
    const ext = p.data.externalRoundId == null ? null : String(p.data.externalRoundId), key = ext ? `r:${ext}` : `t:${Date.parse(p.data.observedAt)}:${value}`;
    if (seen.has(key)) { dup++; return; } seen.add(key);
    out.push({ gameId: ctx.gameId, sourceId: ctx.sourceId, externalRoundId: ext, observedAt: new Date(p.data.observedAt).toISOString(), value, rawValue: raw, sequence: p.data.sequence ?? null, dataQuality: ctx.quality ?? "observed" });
  });
  return { accepted: out, rejected, duplicatesInBatch: dup };
}
/** Any future source plugs in here: it only has to return raw rows. Collectors live outside the UI and must have their terms of use checked before they are connected. */
export interface SourceAdapter { id: string; fetchSince(sinceIso: string | null): Promise<unknown[]> }
