import "server-only";
import { NextResponse } from "next/server";
import type { z } from "zod";
import { LIMIT_MESSAGE, allow, type LimitedAction } from "@/lib/security/limits";
import { LABELS, NOTICE, newSeed, proGate, store, acquireSimulationSlot, releaseSimulationSlot, type SlotKind } from "./server";
import { validSeed } from "./rng";
/** One path for every simulation tool: plan check, rate limit, input check, then the work. The seed is made here unless the user gave a valid one before the run. */
/** The addendum tools (fictional league, multiplier, risk, backtest, alerts, strategy shares) are built and tested but switched off until they are launched on purpose. */
export const addendumOn = () => process.env.ENABLE_SIM_ADDENDUM === "true";
export async function tool<S extends z.ZodTypeAny>(req: Request, schema: S, o: { premium?: boolean; action?: LimitedAction; addendum?: boolean; kind?: SlotKind }, work: (b: z.infer<S>, ctx: { userId: string; tier: "pro" | "premium"; seed: string }) => Promise<{ body: object; kind?: Parameters<typeof store>[1]["kind"]; league?: string; configuration?: object; result?: object; count?: number } | { error: string; status?: number }>) {
  if (o.addendum && !addendumOn()) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const g = await proGate(); if (g instanceof NextResponse) return g; if (o.premium && g.tier !== "premium") return NextResponse.json({ error: "This tool needs a free account. Sign in to use it." }, { status: 403 });
  const b = schema.safeParse(await req.json().catch(() => null)); if (!b.success) return NextResponse.json({ error: b.error.issues[0]?.message ?? "Invalid request" }, { status: 400 });
  const wanted = (b.data as { seed?: unknown }).seed; if (wanted != null && !validSeed(wanted)) return NextResponse.json({ error: "A seed is 1 to 16 letters or numbers." }, { status: 400 });
  if (!(await allow(g.id, o.action ?? "simulate"))) return NextResponse.json({ error: LIMIT_MESSAGE }, { status: 429 }); const seed = (wanted as string | undefined) ?? newSeed();
  const slot = await acquireSimulationSlot(g.id, o.kind ?? "match"); if (!slot.slotId) return NextResponse.json({ error: slot.error ?? "Simulation capacity is busy." }, { status: 429 });
  try { const r = await work(b.data, { userId: g.id, tier: g.tier, seed }); if ("error" in r) return NextResponse.json({ error: r.error }, { status: r.status ?? 400 });
    const id = r.kind ? await store(g.id, { kind: r.kind, league: r.league ?? "synthetic", configuration: r.configuration ?? {}, seed, result: r.result ?? r.body, count: r.count }) : null; return NextResponse.json({ id, labels: LABELS, notice: NOTICE, seed, ...r.body });
  } catch { return NextResponse.json({ error: "The simulation is temporarily unavailable" }, { status: 503 }); } finally { await releaseSimulationSlot(slot.slotId); }
}
