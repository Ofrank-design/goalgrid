export {};
/**
 * Finds a working model for each language-model provider. For each one it tries the model the app uses now (printing the provider's own
 * error text), then lists the provider's models and tries the likely ones with a tiny request. Prints the env var to set, never keys.
 *   node --env-file=.env.local --import tsx scripts/probe-llm.ts
 */
const e = process.env;
type Res = { ok: boolean; status: number; msg: string };
const msgOf = (j: unknown): string => { const o = (j ?? {}) as Record<string, any>; const m = o.error?.message ?? o.error ?? o.message ?? o.detail; return (typeof m === "string" ? m : JSON.stringify(m ?? o)).replace(/\s+/g, " ").slice(0, 220); };
async function post(url: string, headers: Record<string, string>, body: unknown): Promise<Res> {
  try { const r = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json", ...headers }, body: JSON.stringify(body) }); const j = await r.json().catch(() => null); return { ok: r.ok, status: r.status, msg: r.ok ? "" : msgOf(j) }; }
  catch (err) { return { ok: false, status: 0, msg: (err as Error).message }; }
}
async function get(url: string, headers: Record<string, string>): Promise<any> { try { const r = await fetch(url, { headers }); return r.ok ? await r.json() : null; } catch { return null; } }
const rank = (id: string, prefer: RegExp[]) => { const i = prefer.findIndex(p => p.test(id)); return i < 0 ? 99 : i; };

interface P { name: string; envVar: string; current: string; key?: string; list: () => Promise<string[]>; test: (m: string) => Promise<Res>; prefer: RegExp[]; skip?: RegExp }
// Groq's JSON mode rejects any reply that is not valid JSON, and reasoning models (gpt-oss) spend part of max_tokens thinking first, so the
// test asks for a tiny JSON object and leaves room for that thinking.
const openAi = (url: string, key: string, json: boolean) => (m: string) => post(url, { Authorization: `Bearer ${key}` }, { model: m, max_tokens: 400, messages: [{ role: "user", content: json ? 'Reply with exactly this JSON object and nothing else: {"ok":true}' : "Say ok." }], ...(json ? { response_format: { type: "json_object" } } : {}) });
const providers: P[] = [
  { name: "Anthropic", envVar: "ANTHROPIC_MODEL", current: e.ANTHROPIC_MODEL ?? "claude-haiku-4-5-20251001", key: e.ANTHROPIC_API_KEY,
    list: async () => ((await get("https://api.anthropic.com/v1/models?limit=100", { "x-api-key": e.ANTHROPIC_API_KEY ?? "", "anthropic-version": "2023-06-01" }))?.data ?? []).map((x: any) => x.id),
    test: m => post("https://api.anthropic.com/v1/messages", { "x-api-key": e.ANTHROPIC_API_KEY ?? "", "anthropic-version": "2023-06-01" }, { model: m, max_tokens: 8, temperature: 0.2, messages: [{ role: "user", content: "Say ok." }] }),
    prefer: [/haiku/i, /sonnet/i] },
  { name: "Groq", envVar: "GROQ_MODEL", current: e.GROQ_MODEL ?? "llama-3.3-70b-versatile", key: e.GROQ_API_KEY,
    list: async () => ((await get("https://api.groq.com/openai/v1/models", { Authorization: `Bearer ${e.GROQ_API_KEY}` }))?.data ?? []).map((x: any) => x.id),
    test: openAi("https://api.groq.com/openai/v1/chat/completions", e.GROQ_API_KEY ?? "", true), prefer: [/llama-3\.3-70b/, /llama.*70b/, /gpt-oss-120b/, /gpt-oss/, /qwen/, /llama/], skip: /whisper|guard|tts|playai|orpheus|embed/i },
  { name: "NVIDIA", envVar: "NVIDIA_MODEL", current: e.NVIDIA_MODEL ?? "meta/llama-3.3-70b-instruct", key: e.NVIDIA_API_KEY,
    list: async () => ((await get("https://integrate.api.nvidia.com/v1/models", { Authorization: `Bearer ${e.NVIDIA_API_KEY}` }))?.data ?? []).map((x: any) => x.id),
    test: openAi("https://integrate.api.nvidia.com/v1/chat/completions", e.NVIDIA_API_KEY ?? "", false), prefer: [/llama-3\.3-70b-instruct/, /llama-3\.1-70b-instruct/, /llama.*70b.*instruct/, /nemotron.*70b/, /llama.*instruct/], skip: /embed|rerank|vision|vlm|guard|reward|clip|parse|nv-/i },
  { name: "Gemini", envVar: "GEMINI_MODEL", current: e.GEMINI_MODEL ?? "gemini-2.5-flash", key: e.GEMINI_API_KEY,
    list: async () => ((await get("https://generativelanguage.googleapis.com/v1beta/models?pageSize=200", { "x-goog-api-key": e.GEMINI_API_KEY ?? "" }))?.models ?? []).filter((x: any) => (x.supportedGenerationMethods ?? []).includes("generateContent")).map((x: any) => String(x.name).replace(/^models\//, "")),
    test: m => post(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(m)}:generateContent`, { "x-goog-api-key": e.GEMINI_API_KEY ?? "" }, { contents: [{ role: "user", parts: [{ text: "Say ok." }] }], generationConfig: { maxOutputTokens: 64 } }),
    prefer: [/^gemini-[\d.]+-flash$/, /flash/, /pro/], skip: /image|tts|live|embed|audio|robotics|computer|thinking|lite|preview|exp/i },
];

async function main() {
  for (const p of providers) {
    console.log(`\n== ${p.name} ==`);
    if (!p.key) { console.log("  SKIP (no key in .env.local)"); continue; }
    const cur = await p.test(p.current);
    console.log(`  current model ${p.current}: ${cur.ok ? "works" : `HTTP ${cur.status}  ${cur.msg}`}`);
    if (cur.ok) continue;
    const all = [...new Set(await p.list())].filter(id => !(p.skip && p.skip.test(id)));
    if (!all.length) { console.log("  could not list models (key or plan problem), nothing to try"); continue; }
    const cands = all.sort((a, b) => rank(a, p.prefer) - rank(b, p.prefer) || b.localeCompare(a)).slice(0, 6);
    let found = false;
    for (const m of cands) { const r = await p.test(m); console.log(`  try ${m}: ${r.ok ? "works" : `HTTP ${r.status}  ${r.msg.slice(0, 100)}`}`); if (r.ok) { console.log(`  >>> set ${p.envVar}=${m}`); found = true; break; } }
    if (!found) console.log(`  no candidate worked; models on offer: ${all.slice(0, 12).join(", ")}`);
  }
}
main();