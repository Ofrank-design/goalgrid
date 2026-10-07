import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { simulateMatch, type MatchSim } from "../../src/lib/simulation/match";
import { MatchPlayer } from "../../src/components/MatchPlayer";
import { click, frames, hash, installDom, mount, type Trace } from "./harness";

/**
 * Golden master for the match player. Playback is scripted and deterministic, and the HTML at every checkpoint is hashed.
 * GOLDEN_UPDATE=1 re-records (only do that for an intended visual change, reviewed by eye). Set GOLDEN_DUMP=dir to write the HTML for diffing.
 */
const GOLDEN = path.join(__dirname, "match-player.golden.json");
const poisson = (l: number, k: number) => Math.exp(-l) * l ** k / Array.from({ length: k }, (_, i) => i + 1).reduce((a, b) => a * b, 1);
const M = (() => { const m = Array.from({ length: 8 }, (_, i) => Array.from({ length: 8 }, (_, j) => poisson(1.7, i) * poisson(1.1, j))), s = m.flat().reduce((a, b) => a + b, 0); return m.map(r => r.map(v => v / s)); })();
const xg = { home: 1.7, away: 1.1 };
function seedWhere(pred: (s: MatchSim) => boolean) { for (let i = 1; i < 400; i++) { const s = simulateMatch(M, xg, `GOLD${i}`); if (pred(s)) return s; } throw new Error("no seed found"); }
const scenarios: { name: string; sim: MatchSim & { baseline?: { home: number; draw: number; away: number } }; home: string; away: string; reducedMotion?: boolean }[] = [
  { name: "home-win", sim: seedWhere(s => s.final.home >= 3 && s.final.away <= 1), home: "arsenal", away: "chelsea" },
  { name: "goalless-with-baseline", sim: { ...seedWhere(s => s.final.home === 0 && s.final.away === 0), baseline: { home: 0.45, draw: 0.28, away: 0.27 } }, home: "liverpool", away: "manchester-city" },
  { name: "away-win-reduced-motion", sim: seedWhere(s => s.final.away > s.final.home + 1), home: "chelsea", away: "arsenal", reducedMotion: true },
];

async function record(sc: (typeof scenarios)[number], dump?: (label: string, html: string) => void): Promise<Trace> {
  const dom = installDom({ reducedMotion: sc.reducedMotion }), trace: Trace = {};
  const view = await mount(dom, MatchPlayer, { sim: sc.sim, homeSlug: sc.home, awaySlug: sc.away, autoplay: true });
  const snap = (label: string) => { const h = view.html(); trace[label] = hash(h); dump?.(label, h); };
  snap("initial");
  let done = 0;
  for (const target of [1, 5, 30, 120, 300, 600, 900, 1400]) { await frames(target - done); done = target; snap(`frame-${target}`); }
  // Every control, in DOM order, then a little more playback after each.
  const labels = view.buttons().map(b => (b.getAttribute("aria-label") ?? b.textContent ?? "").trim());
  for (let i = 0; i < labels.length; i++) {
    await click(view.buttons()[i]); snap(`click-${i}-${labels[i]}-now`);
    await frames(40); snap(`click-${i}-${labels[i]}+40`);
  }
  await frames(600); snap("after-controls+600");
  await frames(2500); snap("end");
  trace["_buttons"] = hash(labels.join("|"));
  await view.root.unmount();
  return trace;
}

for (const sc of scenarios) {
  test(`match player renders identically: ${sc.name}`, async () => {
    const dumpDir = process.env.GOLDEN_DUMP && path.join(process.env.GOLDEN_DUMP, sc.name);
    if (dumpDir) fs.mkdirSync(dumpDir, { recursive: true });
    const trace = await record(sc, dumpDir ? (l, h) => fs.writeFileSync(path.join(dumpDir, `${l.replace(/[^\w.+-]+/g, "_")}.html`), h) : undefined);
    const golden: Record<string, Trace> = fs.existsSync(GOLDEN) ? JSON.parse(fs.readFileSync(GOLDEN, "utf8")) : {};
    if (process.env.GOLDEN_UPDATE) { golden[sc.name] = trace; fs.writeFileSync(GOLDEN, JSON.stringify(golden, null, 1) + "\n"); return; }
    assert.ok(golden[sc.name], "no golden recorded for this scenario (run with GOLDEN_UPDATE=1 on known-good code)");
    const bad = Object.keys({ ...golden[sc.name], ...trace }).filter(k => golden[sc.name][k] !== trace[k]);
    assert.deepEqual(bad, [], `rendering changed at: ${bad.slice(0, 6).join(", ")}${bad.length > 6 ? ` (+${bad.length - 6} more)` : ""}`);
    // A recording that never moves would make this test meaningless.
    assert.ok(new Set(Object.values(trace)).size >= 15, "playback produced too few distinct frames");
  });
}
