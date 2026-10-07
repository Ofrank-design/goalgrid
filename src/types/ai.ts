import type { Probs } from "./prediction";
export interface Fact { id: string; text: string }
export interface LlmReason { text: string; facts: string[] }
export interface LlmOutput { home: number; draw: number; away: number; score: { home: number; away: number }; btts: number; over25: number; reasons: LlmReason[]; uncertainty: string }
export interface LlmRun { provider: string; model: string; ok: boolean; output?: LlmOutput; error?: string; latencyMs: number }
export interface AiAnalysis {
  probabilities: Probs; statistical: Probs;
  llm: { probabilities: Probs | null; used: number; asked: number; excluded: { provider: string; reason: string }[]; disagreement: number | null };
  reasons: { text: string; facts: string[]; by: string }[]; uncertainty: string | null; facts: Fact[];
  perModel: { provider: string; model: string; probabilities: Probs; score: { home: number; away: number }; reasons: LlmReason[] }[]; generatedAt: string;
}
