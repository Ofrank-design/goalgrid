/** Published-mechanism verification. A scheme is registered only when a source publishes its verification inputs and documentation. Nothing is guessed: a source with no registered scheme returns UNABLE TO VERIFY, and the code never tries to reconstruct private server logic. */
export type VerifyStatus = "VALID" | "INVALID" | "UNABLE_TO_VERIFY";
export interface Scheme { id: string; name: string; documentationUrl: string; inputs: string[]; derive(inputs: Record<string, string>): { derived: string; algorithm: string } }
const SCHEMES = new Map<string, Scheme>(), BY_SOURCE = new Map<string, string>();
/** Registers a documented scheme for a source. There are none by default. */
export function registerScheme(scheme: Scheme, sourceIds: string[]) { SCHEMES.set(scheme.id, scheme); for (const s of sourceIds) BY_SOURCE.set(s, scheme.id); }
export const clearSchemes = () => { SCHEMES.clear(); BY_SOURCE.clear(); };
export const schemeFor = (sourceId: string) => SCHEMES.get(BY_SOURCE.get(sourceId) ?? "") ?? null;
export interface VerifyResult { status: VerifyStatus; message: string; input: Record<string, string> | null; algorithm: string | null; derived: string | null; expected: string | null; match: boolean | null; documentationUrl: string | null }
export function verify(sourceId: string, inputs: Record<string, string>, expected: string): VerifyResult {
  const s = schemeFor(sourceId); if (!s) return { status: "UNABLE_TO_VERIFY", message: "Verification unavailable for this source.", input: null, algorithm: null, derived: null, expected: null, match: null, documentationUrl: null };
  const missing = s.inputs.filter(k => !inputs[k]?.trim()); if (missing.length) return { status: "UNABLE_TO_VERIFY", message: `Missing input: ${missing.join(", ")}`, input: inputs, algorithm: s.name, derived: null, expected, match: null, documentationUrl: s.documentationUrl };
  try { const d = s.derive(inputs), match = d.derived === expected.trim(); return { status: match ? "VALID" : "INVALID", message: match ? "The published inputs reproduce the stated result." : "The published inputs do not reproduce the stated result.", input: inputs, algorithm: d.algorithm, derived: d.derived, expected: expected.trim(), match, documentationUrl: s.documentationUrl }; }
  catch { return { status: "UNABLE_TO_VERIFY", message: "The inputs could not be processed.", input: inputs, algorithm: s.name, derived: null, expected, match: null, documentationUrl: s.documentationUrl }; }
}
