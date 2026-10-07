/** Export formatting. CSV cells that start with = + - or @ are prefixed so a spreadsheet never runs them as a formula. */
const cell = (v: unknown): string => { let s = v == null ? "" : String(v); if (/^[=+\-@\t\r]/.test(s) && !/^-?\d+(\.\d+)?$/.test(s)) s = "'" + s; return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
export const toCsv = (header: string[], rows: unknown[][]) => [header, ...rows].map(r => r.map(cell).join(",")).join("\r\n") + "\r\n";
export interface ExportMeta { game: string; source: string; range: string; engineVersion: string; exportedAt: string; observations: number; note: string }
export const EXPORT_NOTE = "Historical analysis of stored observations. Not a prediction and not betting advice. Source terms may limit redistribution of the raw data.";
export function observationsCsv(values: number[], times: string[]) { return toCsv(["observed_at", "value"], values.map((v, i) => [times[i], v])); }
export const metaOf = (m: Omit<ExportMeta, "note" | "exportedAt"> & { exportedAt?: string }): ExportMeta => ({ ...m, exportedAt: m.exportedAt ?? new Date().toISOString(), note: EXPORT_NOTE });
