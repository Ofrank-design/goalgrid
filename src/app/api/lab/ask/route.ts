import { NextResponse } from "next/server";
import { z } from "zod";
import { cached } from "@/lib/cache";
import { getViewer } from "@/lib/app/session";
import { requireUser } from "@/lib/community/api";
import { hasTier } from "@/lib/entitlements";
import { log } from "@/lib/logging/logger";
import { LLMS } from "@/lib/providers/llm";
import { parseJsonObject } from "@/lib/engine/ai/validate";
import { ASK_SYSTEM, askPrompt, buildLabFacts, cleanQuestion, plainSummary, runRef, validateAsk } from "@/lib/lab/ask";
import { isDelayed, loadSeries } from "@/lib/lab/data";
import { ENGINE_VERSION, analyse } from "@/lib/lab/stats";
import { LIMIT_MESSAGE, allow } from "@/lib/security/limits";
export const maxDuration = 60;
const body = z.object({ game: z.string().regex(/^[a-z0-9-]{2,40}$/), source: z.string().regex(/^[a-z0-9-]{2,40}$/), range: z.enum(["1H", "24H", "7D", "30D", "ALL"]).default("24H"), window: z.number().int().min(5).max(200).default(20), threshold: z.number().min(0).max(1000).default(2), question: z.string() });
/** POST /api/lab/ask. Signed-in users only. Facts are computed on the server from stored data; the language model sees only those facts and the question, and its lines are checked against them before anything is shown. */
export async function POST(req: Request) {
  const v = await getViewer(), u = await requireUser(); if (!u || !hasTier(v.tier, "premium")) return NextResponse.json({ error: "Ask the Lab needs a free account. Sign in to use it." }, { status: 403 });
  const p = body.safeParse(await req.json().catch(() => null)), question = p.success ? cleanQuestion(p.data.question) : null; if (!p.success || !question) return NextResponse.json({ error: "Ask a question of at least a few words." }, { status: 400 });
  if (!(await allow(u.id, "ask"))) return NextResponse.json({ error: LIMIT_MESSAGE }, { status: 429 });
  try {
    const s = await loadSeries(p.data.game, p.data.source, p.data.range); if (!s.values.length) return NextResponse.json({ message: "No data available" });
    const a = analyse(s.values, { window: p.data.window, threshold: p.data.threshold, times: s.times }), delayed = isDelayed(s.lastObservedAt), facts = buildLabFacts(a, { values: s.values, range: p.data.range, window: p.data.window, threshold: p.data.threshold, delayed, lastObservedAt: s.lastObservedAt, partial: s.partial });
    const ref = runRef(p.data.game, p.data.source, p.data.range, s.values.length, s.lastObservedAt), meta = { sample: s.values.length, runRef: ref, engineVersion: ENGINE_VERSION, delayed, small: s.values.length < 100 };
    const out = await cached(`ask:${ref}:${p.data.window}:${p.data.threshold}:${question.toLowerCase()}`, 10 * 60_000, 0, async () => {
      for (const l of LLMS.filter(x => x.configured())) { try { const { text } = await l.call(ASK_SYSTEM, askPrompt(facts, question)), ok = validateAsk(parseJsonObject(text), facts); if (ok) return { ...ok, source: "language-model" as const, model: l.model }; } catch (e) { log.warn("ask llm failed", { provider: l.id, message: (e as Error).message }); } }
      return { lines: plainSummary(facts), limitations: "", dropped: 0, source: "analysis" as const, model: null };
    }).then(r => r.value);
    return NextResponse.json({ ...meta, answer: out.lines, limitations: out.limitations, usedModel: out.model, source: out.source, facts: facts.filter(f => out.lines.some(l => l.facts.includes(f.id))), note: out.source === "analysis" ? "No language model answered, so these are the stored results in plain words." : "Every line cites the stored results it came from." });
  } catch { return NextResponse.json({ error: "Ask the Lab is temporarily unavailable" }, { status: 503 }); }
}
