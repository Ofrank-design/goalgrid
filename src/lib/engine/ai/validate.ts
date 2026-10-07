import type { LlmOutput } from "../../../types/ai";
/** Finds the first balanced JSON object in a model reply, tolerating code fences and surrounding prose. */
export function parseJsonObject(text: string): unknown | null {
  const t = text.replace(/```(?:json)?/gi, ""), start = t.indexOf("{"); if (start < 0) return null;
  let depth = 0, inStr = false, esc = false;
  for (let i = start; i < t.length; i++) {
    const c = t[i];
    if (inStr) { if (esc) esc = false; else if (c === "\\") esc = true; else if (c === '"') inStr = false; continue; }
    if (c === '"') inStr = true; else if (c === "{") depth++; else if (c === "}" && --depth === 0) { try { return JSON.parse(t.slice(start, i + 1)); } catch { return null; } }
  }
  return null;
}
const num = (x: unknown) => (typeof x === "number" ? x : typeof x === "string" && x.trim() !== "" ? Number(x) : NaN);
export type Validation = { ok: true; output: LlmOutput } | { ok: false; error: string };
/** Rejects anything that is not a well formed, fact-grounded answer. Unknown fact ids are dropped, and a reason with none left is dropped too. */
export function validateLlm(raw: unknown, factIds: Set<string>): Validation {
  if (!raw || typeof raw !== "object") return { ok: false, error: "not an object" };
  const o = raw as Record<string, unknown>; let p = [num(o.home), num(o.draw), num(o.away)];
  if (p.some(x => !Number.isFinite(x) || x < 0)) return { ok: false, error: "invalid probabilities" };
  if (p.some(x => x > 1)) { if (p.some(x => x > 100)) return { ok: false, error: "invalid probabilities" }; p = p.map(x => x / 100); }
  const sum = p[0] + p[1] + p[2]; if (sum < 0.95 || sum > 1.05) return { ok: false, error: "probabilities do not sum to 1" };
  p = p.map(x => x / sum);
  const sc = o.score as Record<string, unknown> | undefined, sh = num(sc?.home), sa = num(sc?.away);
  if (!Number.isInteger(sh) || !Number.isInteger(sa) || sh < 0 || sa < 0 || sh > 9 || sa > 9) return { ok: false, error: "invalid score" };
  const prob = (x: unknown) => { let v = num(x); if (v > 1 && v <= 100) v /= 100; return Number.isFinite(v) && v >= 0 && v <= 1 ? v : NaN; };
  const btts = prob(o.btts), over25 = prob(o.over25); if (Number.isNaN(btts) || Number.isNaN(over25)) return { ok: false, error: "invalid goal markets" };
  const reasons = (Array.isArray(o.reasons) ? o.reasons : []).slice(0, 4).flatMap(r => {
    const x = r as Record<string, unknown>; if (typeof x?.text !== "string" || !x.text.trim() || !Array.isArray(x.facts)) return [];
    const facts = x.facts.filter((f): f is string => typeof f === "string" && factIds.has(f)); return facts.length ? [{ text: x.text.trim().slice(0, 240), facts }] : [];
  });
  if (!reasons.length) return { ok: false, error: "no reason cites a provided fact" };
  return { ok: true, output: { home: p[0], draw: p[1], away: p[2], score: { home: sh, away: sa }, btts, over25, reasons, uncertainty: typeof o.uncertainty === "string" ? o.uncertainty.trim().slice(0, 240) : "" } };
}
