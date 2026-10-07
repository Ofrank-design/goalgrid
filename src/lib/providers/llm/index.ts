import "server-only";
import { env } from "@/lib/env";
import { providerFetch } from "../http";
import { ProviderError, type ProviderId } from "../types";
import { extractAnthropic, extractGemini, extractOpenAI } from "./extract";
export interface Llm { id: Extract<ProviderId, "groq" | "anthropic" | "openrouter" | "gemini" | "nvidia">; model: string; configured(): boolean; call(system: string, user: string): Promise<{ text: string; latencyMs: number }> }
const TIMEOUT = 25_000, MAX_TOKENS = 700;
const need = (k: string | undefined, id: ProviderId) => { if (!k) throw new ProviderError(id, "auth", "Not configured"); return k; };
function openAiCompatible(id: Llm["id"], url: string, keyOf: () => string | undefined, model: string, json: boolean): Llm {
  return { id, model, configured: () => Boolean(keyOf()), async call(system, user) {
    const { json: j, latencyMs } = await providerFetch<unknown>({ provider: id, url, method: "POST", timeoutMs: TIMEOUT, retries: 0, headers: { Authorization: `Bearer ${need(keyOf(), id)}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model, temperature: 0.2, max_tokens: MAX_TOKENS, messages: [{ role: "system", content: system }, { role: "user", content: user }], ...(json ? { response_format: { type: "json_object" } } : {}) }) });
    const text = extractOpenAI(j); if (!text) throw new ProviderError(id, "bad_response", "No text in reply"); return { text, latencyMs };
  } };
}
/** Models are env-overridable, so a retired model name is a config change, not a code change. Check them against each provider's current list. */
export const LLMS: Llm[] = [
  openAiCompatible("groq", "https://api.groq.com/openai/v1/chat/completions", () => env().GROQ_API_KEY, process.env.GROQ_MODEL ?? "llama-3.3-70b-versatile", true),
  openAiCompatible("openrouter", "https://openrouter.ai/api/v1/chat/completions", () => env().OPENROUTER_API_KEY, process.env.OPENROUTER_MODEL ?? "meta-llama/llama-3.3-70b-instruct", false),
  openAiCompatible("nvidia", "https://integrate.api.nvidia.com/v1/chat/completions", () => env().NVIDIA_API_KEY, process.env.NVIDIA_MODEL ?? "meta/llama-3.3-70b-instruct", false),
  { id: "anthropic", model: process.env.ANTHROPIC_MODEL ?? "claude-haiku-4-5-20251001", configured: () => Boolean(env().ANTHROPIC_API_KEY), async call(system, user) {
    const { json, latencyMs } = await providerFetch<unknown>({ provider: "anthropic", url: "https://api.anthropic.com/v1/messages", method: "POST", timeoutMs: TIMEOUT, retries: 0,
      headers: { "x-api-key": need(env().ANTHROPIC_API_KEY, "anthropic"), "anthropic-version": "2023-06-01", "Content-Type": "application/json" },
      body: JSON.stringify({ model: process.env.ANTHROPIC_MODEL ?? "claude-haiku-4-5-20251001", max_tokens: MAX_TOKENS, temperature: 0.2, system, messages: [{ role: "user", content: user }] }) });
    const text = extractAnthropic(json); if (!text) throw new ProviderError("anthropic", "bad_response", "No text in reply"); return { text, latencyMs }; } },
  { id: "gemini", model: process.env.GEMINI_MODEL ?? "gemini-2.5-flash", configured: () => Boolean(env().GEMINI_API_KEY), async call(system, user) {
    const model = process.env.GEMINI_MODEL ?? "gemini-2.5-flash";
    const { json, latencyMs } = await providerFetch<unknown>({ provider: "gemini", url: `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, method: "POST", timeoutMs: TIMEOUT, retries: 0,
      headers: { "x-goog-api-key": need(env().GEMINI_API_KEY, "gemini"), "Content-Type": "application/json" },
      body: JSON.stringify({ systemInstruction: { parts: [{ text: system }] }, contents: [{ role: "user", parts: [{ text: user }] }], generationConfig: { temperature: 0.2, maxOutputTokens: MAX_TOKENS, responseMimeType: "application/json" } }) });
    const text = extractGemini(json); if (!text) throw new ProviderError("gemini", "bad_response", "No text in reply"); return { text, latencyMs }; } },
];
