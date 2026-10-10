import "server-only";
import { cached } from "@/lib/cache";
import { log } from "@/lib/logging/logger";
import { recordHealth } from "@/lib/providers/health";
import { LLMS } from "@/lib/providers/llm";
import { ProviderError } from "@/lib/providers/types";
import { getPredictions } from "@/lib/engine/predictions";
import { getMatchContext } from "@/lib/engine/ingestion/context";
import { getMatchSignals } from "@/lib/engine/ingestion/signals";
import { buildFacts } from "./facts";
import { SYSTEM_PROMPT, userPrompt } from "./prompt";
import { parseJsonObject, validateLlm } from "./validate";
import { combine } from "./consensus";
import type { AiAnalysis, LlmRun } from "@/types/ai";
export class AnalysisUnavailable extends Error {}
/** All configured language models read the same verified facts in parallel. Their answers are validated, then blended in at a small, fixed weight. */
export function getAnalysis(date: string, matchId: string): Promise<AiAnalysis> {
  return cached(`ai:${matchId}`, 6 * 3_600_000, 24 * 3_600_000, async () => {
    const item = (await getPredictions(date)).items.find(i => i.match.id === matchId);
    if (!item) throw new AnalysisUnavailable("Match not found"); if (!item.prediction) throw new AnalysisUnavailable(item.reason ?? "No statistical prediction for this match");
    const ctx = await getMatchContext(item.match), signals = await getMatchSignals(item.match).catch(() => null), facts = buildFacts({ match: item.match, prediction: item.prediction, market: ctx.market, weather: ctx.weather, news: ctx.news, signals });
    const ids = new Set(facts.map(f => f.id)), user = userPrompt(facts);
    const runs: LlmRun[] = await Promise.all(LLMS.filter(l => l.configured()).map(async (l): Promise<LlmRun> => {
      const t0 = Date.now();
      try {
        const { text, latencyMs } = await l.call(SYSTEM_PROMPT, user), v = validateLlm(parseJsonObject(text), ids); void recordHealth(l.id, v.ok, latencyMs, v.ok ? undefined : "invalid_output");
        return v.ok ? { provider: l.id, model: l.model, ok: true, output: v.output, latencyMs } : { provider: l.id, model: l.model, ok: false, error: `invalid output: ${v.error}`, latencyMs };
      } catch (e) { const kind = e instanceof ProviderError ? e.kind : "failed"; log.warn("llm call failed", { provider: l.id, kind }); void recordHealth(l.id, false, undefined, kind); return { provider: l.id, model: l.model, ok: false, error: kind, latencyMs: Date.now() - t0 }; }
    }));
    return { statistical: item.prediction.probabilities, facts, generatedAt: new Date().toISOString(), ...combine(item.prediction.probabilities, runs) };
  }).then(r => r.value);
}
