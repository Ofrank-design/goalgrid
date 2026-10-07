import type { Probs } from "../../../types/prediction";
import type { AiAnalysis, LlmRun } from "../../../types/ai";
export const LLM_WEIGHT = 0.25, OUTLIER_LIMIT = 0.3;
const mix = (a: Probs, b: Probs, w: number): Probs => { const r = { home: a.home * (1 - w) + b.home * w, draw: a.draw * (1 - w) + b.draw * w, away: a.away * (1 - w) + b.away * w }, s = r.home + r.draw + r.away; return { home: r.home / s, draw: r.draw / s, away: r.away / s }; };
const gap = (a: Probs, b: Probs) => Math.max(Math.abs(a.home - b.home), Math.abs(a.draw - b.draw), Math.abs(a.away - b.away));
/** The statistical consensus stays in charge. Language models move it by at most LLM_WEIGHT, and any answer far from it is set aside. */
export function combine(stat: Probs, runs: LlmRun[], weight = LLM_WEIGHT): Pick<AiAnalysis, "probabilities" | "llm" | "reasons" | "uncertainty" | "perModel"> {
  const excluded: AiAnalysis["llm"]["excluded"] = [], kept: (LlmRun & { output: NonNullable<LlmRun["output"]> })[] = [];
  for (const r of runs) {
    if (!r.ok || !r.output) { excluded.push({ provider: r.provider, reason: r.error ?? "no valid answer" }); continue; }
    const g = gap(stat, r.output); if (g > OUTLIER_LIMIT) excluded.push({ provider: r.provider, reason: `differs from the statistical consensus by ${Math.round(g * 100)} points` }); else kept.push(r as typeof kept[number]);
  }
  const n = kept.length, avg = (f: (o: typeof kept[number]["output"]) => number) => kept.reduce((a, r) => a + f(r.output), 0) / n;
  const llmP: Probs | null = n ? { home: avg(o => o.home), draw: avg(o => o.draw), away: avg(o => o.away) } : null;
  const sd = (f: (o: typeof kept[number]["output"]) => number) => { const m = avg(f); return Math.sqrt(kept.reduce((a, r) => a + (f(r.output) - m) ** 2, 0) / n); };
  const reasons: AiAnalysis["reasons"] = [], seen = new Set<string>();
  for (let k = 0; k < 3 && reasons.length < 3; k++) for (const r of kept) { const x = r.output.reasons[k]; if (!x || reasons.length >= 3) continue; const key = x.text.toLowerCase(); if (!seen.has(key)) { seen.add(key); reasons.push({ text: x.text, facts: x.facts, by: r.provider }); } }
  return { probabilities: llmP ? mix(stat, llmP, weight) : stat,
    llm: { probabilities: llmP, used: n, asked: runs.length, excluded, disagreement: n >= 2 ? (sd(o => o.home) + sd(o => o.draw) + sd(o => o.away)) / 3 : null },
    reasons, uncertainty: kept.map(r => r.output.uncertainty).find(u => u) ?? null,
    perModel: runs.filter(r => r.ok && r.output).map(r => ({ provider: r.provider, model: r.model, probabilities: { home: r.output!.home, draw: r.output!.draw, away: r.output!.away }, score: r.output!.score, reasons: r.output!.reasons })) };
}
